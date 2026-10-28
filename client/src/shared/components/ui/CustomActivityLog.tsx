import React, { useEffect, useState } from 'react';

import CustomButton from './CustomButton';
import CustomModal from './CustomModal';

export interface ActivityLogSummaryItem {
  label: string;
  /** Left out of the strip when empty. */
  value: string;
}

export interface ActivityLogEntry {
  key: string;
  /** The raw decision (`approved`, `topup_submitted`, …); it picks the entry's colour. */
  decision: string;
  /** The tag text: "Approved", "Top-up". */
  status: string;
  /** The approval stage that acted, when there is one: "HoD", "DoF". */
  stage?: string;
  /** Already formatted for display. */
  date: string;
  actorName?: string;
  actorEmail?: string;
  remark?: string;
  /** A longer remark behind "Show full changes", for edits that list every change. */
  fullRemark?: string;
}

interface CustomActivityLogProps {
  show: boolean;
  onHide: () => void;
  title?: string;
  /** Reference and dates, shown above the activity list. */
  summary: ActivityLogSummaryItem[];
  entries: ActivityLogEntry[];
  loading?: boolean;
  emptyMessage?: string;
}

/** The colour family of a decision; anything else reads as a neutral update. */
const toneOf = (decision: string) => {
  const token = decision.trim().toLowerCase();
  if (token.includes('reject')) return 'rejected';
  if (token.includes('return')) return 'returned';
  if (token.includes('approv') || token.includes('completed')) return 'approved';
  if (token.includes('submit')) return 'submitted';
  return 'updated';
};

/**
 * The stage beside an entry's status. A submission is the applicant's step, whatever stage
 * the record was sent to -- finance and expenditure log a resubmission under that stage, which
 * read as if the HoD had resubmitted -- so a resubmission names the applicant and a first
 * submission names no one. The modules spell the HoD stage two ways; it reads as one here.
 */
const stageLabel = (entry: ActivityLogEntry) => {
  const decision = entry.decision.trim().toLowerCase();
  if (decision === 'resubmitted') return 'Applicant';
  if (toneOf(decision) === 'submitted') return '';
  const stage = entry.stage?.trim() || '';
  if (stage.toLowerCase() === 'hod') return 'HoD';
  // A "Submitted" stage on a "Submitted" step says nothing twice.
  return stage.toLowerCase() === entry.status.toLowerCase() ? '' : stage;
};

/**
 * A record's approval history in a dialog: the reference and submission dates on top, then
 * each step on a rail -- what happened, at which stage, when, by whom, and the remark. Every
 * screen that shows a workflow log uses this one, so they read the same to approvers and
 * to the people who submitted.
 */
const CustomActivityLog: React.FC<CustomActivityLogProps> = ({
  show,
  onHide,
  title = 'Workflow Timeline',
  summary,
  entries,
  loading = false,
  emptyMessage = 'No timeline entries available.',
}) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!show) setExpanded({});
  }, [show]);

  const summaryItems = summary.filter((item) => item.value);

  return (
    <CustomModal
      show={show}
      onHide={onHide}
      title={title}
      size="lg"
      centered
      scrollable
      className="custom-activity-modal"
      footer={
        <CustomButton variant="outline-secondary" onClick={onHide}>
          Close
        </CustomButton>
      }
    >
      <div className="custom-activity-body">
        {summaryItems.length > 0 && (
          <dl className="custom-activity-summary">
            {summaryItems.map((item) => (
              <div key={item.label} className="custom-activity-summary-item">
                <dt className="custom-activity-summary-label">{item.label}</dt>
                <dd className="custom-activity-summary-value">{item.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {loading ? (
          <p className="custom-activity-state">Loading timeline...</p>
        ) : entries.length === 0 ? (
          <p className="custom-activity-state">{emptyMessage}</p>
        ) : (
          <>
            <h6 className="custom-activity-label">Activity</h6>
            <ol className="custom-activity-timeline">
              {entries.map((entry) => {
                const canExpand = Boolean(
                  entry.fullRemark && entry.remark && entry.fullRemark !== entry.remark,
                );
                const isExpanded = canExpand && expanded[entry.key];
                const actorName = entry.actorName?.trim();
                const actorEmail = entry.actorEmail?.trim();
                const sameActor =
                  actorName && actorEmail && actorName.toLowerCase() === actorEmail.toLowerCase();
                const stage = stageLabel(entry);

                return (
                  <li
                    key={entry.key}
                    className={`custom-activity-entry custom-activity-entry--${toneOf(entry.decision)}`}
                  >
                    <div className="custom-activity-entry-head">
                      <span className="custom-activity-status">{entry.status}</span>
                      {stage && <span className="custom-activity-stage">{stage}</span>}
                      <time className="custom-activity-time">{entry.date || '-'}</time>
                    </div>
                    <p className="custom-activity-actor">
                      <span className="custom-activity-actor-name">
                        {actorName || actorEmail || 'Unknown'}
                      </span>
                      {actorName && actorEmail && !sameActor && ` · ${actorEmail}`}
                    </p>
                    {entry.remark && (
                      <p className="custom-activity-remark">
                        {isExpanded ? entry.fullRemark : entry.remark}
                      </p>
                    )}
                    {canExpand && (
                      <button
                        type="button"
                        className="custom-activity-toggle"
                        onClick={() =>
                          setExpanded((prev) => ({ ...prev, [entry.key]: !prev[entry.key] }))
                        }
                      >
                        {isExpanded ? 'Show less' : 'Show full changes'}
                      </button>
                    )}
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </div>
    </CustomModal>
  );
};

export default CustomActivityLog;
