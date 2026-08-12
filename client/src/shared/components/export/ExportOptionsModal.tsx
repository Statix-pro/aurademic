import { AlertTriangle } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';

import CustomButton from '../ui/CustomButton';
import CustomCheckbox from '../ui/CustomCheckbox';
import CustomDropdown, { OptionType } from '../ui/CustomDropdown';
import CustomInput from '../ui/CustomInput';
import CustomModal from '../ui/CustomModal';
import './ExportOptionsModal.css';

/** Status keys the three export endpoints accept. `all` omits the status filter. */
export type ExportStatusOption =
  | 'all'
  | 'pending'
  | 'approved'
  | 'returned'
  | 'rejected'
  | 'archived';

export interface ExportOptions {
  status: ExportStatusOption;
  dateFrom: string;
  dateTo: string;
  /** True once either bound is set: the caller drops fiscalYear so the range can span years. */
  allFiscalYears: boolean;
  includeLineItems: boolean;
}

/**
 * Outcome of a run, so the modal can report a cap or an empty result in place rather
 * than downloading a file the user then has to second-guess.
 */
export interface ExportRunResult {
  downloaded: boolean;
  recordCount: number;
  lineItemCount: number;
  totalMatching: number;
  maxRows: number;
  truncated: boolean;
  message?: string;
}

interface ExportOptionsModalProps {
  show: boolean;
  onHide: () => void;
  title?: string;
  /** Human-readable scope the file inherits from the page (queue, fiscal year, filters). */
  scopeSummary: string[];
  /** Runs the export. Resolves with what happened so the modal can stay open on a cap. */
  onExport: (options: ExportOptions) => Promise<ExportRunResult>;
  exporting?: boolean;
  /** Plural label for the records being exported, e.g. "requests" or "proposals". */
  recordNoun?: string;
}

const STATUS_OPTIONS: OptionType[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'returned', label: 'Returned' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'archived', label: 'Archived' },
];

const DEFAULT_OPTIONS: ExportOptions = {
  status: 'all',
  dateFrom: '',
  dateTo: '',
  allFiscalYears: false,
  includeLineItems: true,
};

const formatCount = (value: number) => Number(value || 0).toLocaleString('en-IN');

const ExportOptionsModal: React.FC<ExportOptionsModalProps> = ({
  show,
  onHide,
  title = 'Export CSV',
  scopeSummary,
  onExport,
  exporting = false,
  recordNoun = 'records',
}) => {
  const [options, setOptions] = useState<ExportOptions>(DEFAULT_OPTIONS);
  const [result, setResult] = useState<ExportRunResult | null>(null);

  // Reopening starts clean: a stale cap warning or a previous date range would otherwise
  // describe an export the user is no longer asking for. Status deliberately resets to
  // "All statuses" rather than following the page's KPI tab — this dropdown is the only
  // thing that decides what the file contains, and it shows that choice on screen.
  useEffect(() => {
    if (show) {
      setOptions(DEFAULT_OPTIONS);
      setResult(null);
    }
  }, [show]);

  const hasDateRange = Boolean(options.dateFrom || options.dateTo);

  // The bounds are inclusive and order-independent server-side, but flagging a reversed
  // range here is clearer than silently swapping it.
  const dateError = useMemo(() => {
    if (options.dateFrom && options.dateTo && options.dateFrom > options.dateTo) {
      return 'The "from" date is after the "to" date.';
    }
    return '';
  }, [options.dateFrom, options.dateTo]);

  const handleExport = async () => {
    if (dateError) {
      return;
    }

    const runResult = await onExport({ ...options, allFiscalYears: hasDateRange });
    setResult(runResult);

    if (runResult.downloaded && !runResult.truncated) {
      onHide();
    }
  };

  const statusValue =
    STATUS_OPTIONS.find((option) => option.value === options.status) || STATUS_OPTIONS[0];

  return (
    <CustomModal
      show={show}
      onHide={onHide}
      title={title}
      size="lg"
      className="export-options-modal"
      footer={
        <>
          <CustomButton variant="light" onClick={onHide} disabled={exporting}>
            Cancel
          </CustomButton>
          <CustomButton
            variant="primary"
            onClick={handleExport}
            loading={exporting}
            disabled={Boolean(dateError)}
          >
            {exporting ? 'Preparing…' : 'Download CSV'}
          </CustomButton>
        </>
      }
    >
      <div className="export-options-body">
        <section className="export-options-scope">
          <span className="export-options-scope-label">This export covers</span>
          <ul className="export-options-scope-list">
            {scopeSummary.map((line) => (
              <li key={line}>{line}</li>
            ))}
            {hasDateRange && (
              <li className="export-options-scope-override">
                Date range set — all fiscal years are searched, not just the one on screen.
              </li>
            )}
          </ul>
        </section>

        <div className="export-options-grid">
          <CustomDropdown
            label="Status"
            name="exportStatus"
            className="export-options-status"
            options={STATUS_OPTIONS}
            value={statusValue}
            onChange={(selected) =>
              setOptions((previous) => ({
                ...previous,
                status: ((selected as OptionType)?.value as ExportStatusOption) || 'all',
              }))
            }
            isDisabled={exporting}
          />
          <CustomInput
            label="From date"
            name="exportDateFrom"
            type="date"
            value={options.dateFrom}
            onChange={(value) => setOptions((previous) => ({ ...previous, dateFrom: value }))}
            disabled={exporting}
          />
          <CustomInput
            label="To date"
            name="exportDateTo"
            type="date"
            value={options.dateTo}
            onChange={(value) => setOptions((previous) => ({ ...previous, dateTo: value }))}
            disabled={exporting}
            error={dateError}
          />
        </div>

        {/* "Head-wise break-up" is the term the finance office uses, and the one the
            schema uses (finance_budget_breakup) — it names what the extra rows are
            grouped by instead of describing them vaguely. */}
        <CustomCheckbox
          label="Include the head-wise break-up"
          name="exportIncludeLineItems"
          checked={options.includeLineItems}
          onChange={(checked) =>
            setOptions((previous) => ({ ...previous, includeLineItems: checked }))
          }
          disabled={exporting}
        />

        {result && (result.truncated || !result.downloaded) && (
          <div
            className={`export-options-result ${result.downloaded ? 'is-warning' : 'is-empty'}`}
            role="status"
          >
            <AlertTriangle size={16} />
            <div>
              {result.message ||
                (result.truncated
                  ? `The server capped this export at ${formatCount(result.maxRows)} ${recordNoun} out of ${formatCount(result.totalMatching)} matching. Narrow the status or date range to get the rest.`
                  : `No ${recordNoun} matched these options.`)}
              {result.downloaded && (
                <span className="export-options-result-note">
                  {' '}
                  The file has downloaded with {formatCount(result.recordCount)} {recordNoun} and{' '}
                  {formatCount(result.lineItemCount)} line items.
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </CustomModal>
  );
};

export default ExportOptionsModal;
