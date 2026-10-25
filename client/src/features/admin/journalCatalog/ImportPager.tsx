import { ChevronLeft, ChevronRight } from 'lucide-react';
import React from 'react';

import CustomButton from '../../../shared/components/ui/CustomButton';

interface ImportPagerProps {
  page: number;
  perPage: number;
  total: number;
  onPage: (page: number) => void;
  disabled?: boolean;
}

/** "51–100 of 642" with previous / next — the lists here are read in order, not jumped through. */
const ImportPager: React.FC<ImportPagerProps> = ({ page, perPage, total, onPage, disabled }) => {
  if (total <= perPage) return null;
  const lastPage = Math.ceil(total / perPage);
  const first = (page - 1) * perPage + 1;
  const last = Math.min(page * perPage, total);

  return (
    <div className="journal-import__pager">
      <span className="journal-import__pager-count">
        {first}–{last} of {total}
      </span>
      <CustomButton
        variant="light"
        size="sm"
        className="journal-import__pager-btn"
        onClick={() => onPage(page - 1)}
        disabled={disabled || page <= 1}
        aria-label="Previous page"
      >
        <ChevronLeft size={16} aria-hidden="true" />
      </CustomButton>
      <CustomButton
        variant="light"
        size="sm"
        className="journal-import__pager-btn"
        onClick={() => onPage(page + 1)}
        disabled={disabled || page >= lastPage}
        aria-label="Next page"
      >
        <ChevronRight size={16} aria-hidden="true" />
      </CustomButton>
    </div>
  );
};

export default ImportPager;
