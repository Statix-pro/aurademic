import { ArrowLeft, Check, Pencil, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-bootstrap';

import {
  OUTCOME_BADGE,
  RESOLUTION_BADGE,
  STATUS_BADGE,
  errorMessage,
  formatDateTime,
} from './importLabels';
import ImportPager from './ImportPager';
import AlertModal from '../../../shared/components/ui/AlertModal';
import CustomButton from '../../../shared/components/ui/CustomButton';
import CustomCheckbox from '../../../shared/components/ui/CustomCheckbox';
import CustomDropdown, { OptionType } from '../../../shared/components/ui/CustomDropdown';
import CustomInput from '../../../shared/components/ui/CustomInput';
import CustomModal from '../../../shared/components/ui/CustomModal';
import CustomTable from '../../../shared/components/ui/CustomTable';
import authenticityUtility from '../../../shared/utils/authenticityUtility';
import { AdminIconButton } from '../components/AdminScreen';

import type {
  ApiEnvelope,
  FieldChange,
  ImportBatch,
  ImportRow,
  ImportSource,
  Outcome,
  Paged,
} from './types';

const PER_PAGE = 50;
const SHOWN_CHANGES = 4;

type OutcomeFilter = Outcome | 'all';

interface Correction {
  row: ImportRow;
  journal_name: string;
  print_issn: string;
  online_issn: string;
  category: string;
}

interface Failure {
  rowId: number;
  journalName: string;
  reason: string;
}

interface ImportBatchViewProps {
  batchId: number;
  sources: ImportSource[];
  exclusionReasons: Record<string, string>;
  /** Back to the list this import was opened from; absent right after an upload. */
  onBack?: () => void;
  /** Called after the import is applied, discarded or has exceptions resolved. */
  onChanged?: () => void;
}

const LEVEL_OPTIONS: OptionType[] = [
  { value: 'International', label: 'International' },
  { value: 'National', label: 'National' },
];

const showValue = (value: FieldChange['to']) =>
  value === null || value === undefined || value === '' ? '—' : String(value);

/**
 * One import, as previewed or as applied: what the file held, what each journal will become,
 * and the exceptions a person has to look at. Exceptions are accepted or excluded in bulk; one
 * that needs a corrected ISSN or level is fixed in place and accepted with it.
 */
const ImportBatchView: React.FC<ImportBatchViewProps> = ({
  batchId,
  sources,
  exclusionReasons,
  onBack,
  onChanged,
}) => {
  const [batch, setBatch] = useState<ImportBatch | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [outcome, setOutcome] = useState<OutcomeFilter | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [failures, setFailures] = useState<Failure[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirm, setConfirm] = useState<'apply' | 'discard' | null>(null);
  const [correction, setCorrection] = useState<Correction | null>(null);

  const source = sources.find((item) => item.key === batch?.source_key);
  // Paper and staff-ID imports list papers or staff, not journals, and their exceptions are
  // accepted as planned — the correction dialog edits journal fields.
  const isPapers = source?.kind === 'papers';
  const isStaff = source?.kind === 'staff';
  const correctable = !isPapers && !isStaff;
  const noun = isPapers ? 'papers' : isStaff ? 'staff rows' : 'journals';

  const countFor = useCallback(
    (key: Outcome) =>
      (batch?.rowCounts ?? [])
        .filter((count) => count.outcome === key)
        .reduce((sum, count) => sum + count.total, 0),
    [batch],
  );

  const loadBatch = useCallback(async () => {
    const response = (await authenticityUtility.get(
      `/journal-catalog/imports/${batchId}`,
    )) as ApiEnvelope<ImportBatch>;
    setBatch(response.data ?? null);
    return response.data ?? null;
  }, [batchId]);

  // Opens on the exceptions when there are any — they are what needs a person.
  useEffect(() => {
    setOutcome(null);
    setPage(1);
    setSelected(new Set());
    setFailures([]);
    loadBatch()
      .then((loaded) => {
        const exceptions = (loaded?.rowCounts ?? []).some(
          (count) => count.outcome === 'exception' && count.total > 0,
        );
        setOutcome(exceptions ? 'exception' : 'all');
      })
      .catch((err) => setError(errorMessage(err, 'Failed to load the import.')));
  }, [loadBatch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const loadRows = useCallback(async () => {
    if (!outcome) return;
    setLoading(true);
    try {
      const response = (await authenticityUtility.get(`/journal-catalog/imports/${batchId}/rows`, {
        params: {
          outcome: outcome === 'all' ? undefined : outcome,
          search: search || undefined,
          page,
          per_page: PER_PAGE,
        },
      })) as ApiEnvelope<Paged<ImportRow>>;
      setRows(response.data?.rows ?? []);
      setTotal(response.data?.total ?? 0);
      setError('');
    } catch (err) {
      setRows([]);
      setTotal(0);
      setError(errorMessage(err, `Failed to load the ${noun} in this import.`));
    } finally {
      setLoading(false);
    }
  }, [batchId, outcome, search, page, noun]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const refresh = async () => {
    await Promise.all([loadBatch(), loadRows()]);
    setSelected(new Set());
    onChanged?.();
  };

  const runAction = async (action: 'apply' | 'discard') => {
    setConfirm(null);
    setWorking(true);
    try {
      await authenticityUtility.post(`/journal-catalog/imports/${batchId}/${action}`);
      setError('');
      await refresh();
    } catch (err) {
      setError(errorMessage(err, `Failed to ${action} the import.`));
    } finally {
      setWorking(false);
    }
  };

  const resolve = async (
    action: 'accept' | 'exclude',
    rowIds: number[],
    overrides?: Record<number, Record<string, string>>,
  ) => {
    setWorking(true);
    setFailures([]);
    try {
      await authenticityUtility.post(`/journal-catalog/imports/${batchId}/exceptions/resolve`, {
        action,
        rowIds,
        overrides,
      });
      setError('');
      setCorrection(null);
      await refresh();
    } catch (err) {
      const data = (err as { response?: { data?: { data?: { failures?: Failure[] } } } }).response
        ?.data?.data;
      setFailures(data?.failures ?? []);
      setError(errorMessage(err, 'Failed to resolve the selected rows.'));
    } finally {
      setWorking(false);
    }
  };

  const openCorrection = (row: ImportRow) => {
    const create = row.payload.action === 'add' ? row.payload.create : undefined;
    setError('');
    setFailures([]);
    setCorrection({
      row,
      journal_name: create?.journal_name ?? row.journal_name,
      print_issn: create?.print_issn ?? '',
      online_issn: create?.online_issn ?? '',
      // Starts on "Keep as it is": a level the admin picks here is an admin decision no later
      // import overrides, so it is sent only when they actually choose one.
      category: '',
    });
  };

  /**
   * Only what the admin filled in is sent: for a journal already in the list, an empty field
   * means "leave it as it is", not "clear it".
   */
  const submitCorrection = () => {
    if (!correction) return;
    const isAdd = correction.row.payload.action === 'add';
    const overrides: Record<string, string> = {};
    if (isAdd) overrides.journal_name = correction.journal_name;
    for (const field of ['print_issn', 'online_issn', 'category'] as const) {
      if (isAdd || correction[field].trim()) overrides[field] = correction[field].trim();
    }
    if (isAdd && !overrides.category) delete overrides.category;
    resolve('accept', [correction.row.id], { [correction.row.id]: overrides });
  };

  const isApplied = batch?.status === 'applied';
  const openExceptions = rows.filter(
    (row) => row.outcome === 'exception' && row.resolution === 'pending',
  );
  const canResolve = isApplied;
  const selectable = canResolve && openExceptions.length > 0;
  // The Actions column appears only when a row on this page can be acted on.
  const showActions = selectable;
  const allOnPageSelected =
    openExceptions.length > 0 && openExceptions.every((row) => selected.has(row.id));

  const toggle = (rowId: number, checked: boolean) =>
    setSelected((previous) => {
      const next = new Set(previous);
      if (checked) next.add(rowId);
      else next.delete(rowId);
      return next;
    });

  const filterOptions: OptionType[] = useMemo(
    () => [
      { value: 'exception', label: `Needs review (${countFor('exception')})` },
      { value: 'add', label: `Add (${countFor('add')})` },
      { value: 'update', label: `Update (${countFor('update')})` },
      { value: 'unchanged', label: `No change (${countFor('unchanged')})` },
      { value: 'all', label: `All ${noun}` },
    ],
    [countFor, noun],
  );

  const columns = [
    ...(selectable
      ? [
          {
            key: 'select',
            label: '',
            style: { width: '48px' },
            render: (row: ImportRow) =>
              row.outcome === 'exception' && row.resolution === 'pending' ? (
                <CustomCheckbox
                  name={`select-${row.id}`}
                  label=""
                  aria-label={`Select ${row.journal_name}`}
                  checked={selected.has(row.id)}
                  onChange={(checked) => toggle(row.id, checked)}
                />
              ) : null,
          },
        ]
      : []),
    {
      key: 'source_row',
      label: 'Line',
      style: { width: '72px' },
      render: (row: ImportRow) => <span className="admin-muted">{row.source_row}</span>,
    },
    {
      key: 'journal_name',
      label: isPapers ? 'Paper' : isStaff ? 'Staff member' : 'Journal',
      style: { width: '30%' },
      render: (row: ImportRow) => (
        <>
          <span className="admin-name">{row.journal_name}</span>
          <span
            className={`admin-badge admin-badge--trailing ${OUTCOME_BADGE[row.outcome].className}`}
          >
            {OUTCOME_BADGE[row.outcome].label}
          </span>
          {isApplied && row.outcome === 'exception' && (
            <span
              className={`admin-badge admin-badge--trailing ${RESOLUTION_BADGE[row.resolution].className}`}
            >
              {RESOLUTION_BADGE[row.resolution].label}
            </span>
          )}
        </>
      ),
    },
    {
      key: 'changes',
      label: 'Changes',
      render: (row: ImportRow) =>
        row.changes?.length ? (
          <ul className="journal-import__changes">
            {row.changes.slice(0, SHOWN_CHANGES).map((change) => (
              <li key={change.field}>
                <span className="journal-import__change-field">{change.field}</span>{' '}
                {showValue(change.from)} → {showValue(change.to)}
              </li>
            ))}
            {row.changes.length > SHOWN_CHANGES && (
              <li className="admin-muted">+{row.changes.length - SHOWN_CHANGES} more</li>
            )}
          </ul>
        ) : (
          <span className="admin-muted">—</span>
        ),
    },
    {
      key: 'reason',
      label: 'Why',
      style: { width: '28%' },
      render: (row: ImportRow) =>
        row.reason ? (
          <span className="journal-import__reason">{row.reason}</span>
        ) : (
          <span className="admin-muted">—</span>
        ),
    },
  ];

  const rowActions = canResolve
    ? (row: ImportRow) =>
        row.outcome === 'exception' && row.resolution === 'pending' ? (
          <div className="admin-actions">
            <AdminIconButton
              icon={<Check size={16} aria-hidden="true" />}
              label="Accept as proposed"
              onClick={() => resolve('accept', [row.id])}
              disabled={working}
            />
            {correctable && (
              <AdminIconButton
                icon={<Pencil size={16} aria-hidden="true" />}
                label="Correct and accept"
                onClick={() => openCorrection(row)}
                disabled={working}
              />
            )}
            <AdminIconButton
              icon={<X size={16} aria-hidden="true" />}
              label="Exclude"
              variant="danger"
              onClick={() => resolve('exclude', [row.id])}
              disabled={working}
            />
          </div>
        ) : null
    : undefined;

  if (!batch) {
    return error ? (
      <Alert variant="danger">{error}</Alert>
    ) : (
      <div className="admin-empty">Loading…</div>
    );
  }

  const summary = batch.summary;
  // A reference file (Scopus Source List, SCImago) covers every journal worldwide; only the
  // KSRCT ones are used, so the rest are a skip by design, counted apart from rows left out
  // for a reason that might matter.
  const isReference = source?.kind === 'reference';
  const skipped = isReference ? (summary.excluded?.not_in_list ?? 0) : 0;
  const leftOut = Object.entries(summary.excluded ?? {}).filter(
    ([reason]) => !(isReference && reason === 'not_in_list'),
  );
  const leftOutTotal = leftOut.reduce((sum, [, count]) => sum + count, 0);
  const matched =
    countFor('add') + countFor('update') + countFor('unchanged') + countFor('exception');

  const stats: { label: string; value: number }[] = isReference
    ? [
        { label: 'Rows read', value: summary.rowsRead },
        { label: 'KSRCT journals matched', value: matched },
        { label: 'Update', value: countFor('update') },
        { label: 'No change', value: countFor('unchanged') },
        { label: 'Needs review', value: countFor('exception') },
        { label: 'Other journals (skipped)', value: skipped },
      ]
    : [
        { label: 'Rows read', value: summary.rowsRead },
        { label: 'Add', value: countFor('add') },
        { label: 'Update', value: countFor('update') },
        { label: 'No change', value: countFor('unchanged') },
        { label: 'Needs review', value: countFor('exception') },
        { label: 'Left out', value: leftOutTotal },
      ];

  return (
    <div className="journal-import__batch">
      <div className="journal-import__batch-head">
        {onBack && (
          <CustomButton
            variant="light"
            size="sm"
            className="journal-import__back"
            onClick={onBack}
            aria-label="Back to import history"
          >
            <ArrowLeft size={16} aria-hidden="true" />
          </CustomButton>
        )}
        <div className="journal-import__batch-title">
          <h2 className="journal-import__section-title">
            Import #{batch.id} · {source?.label ?? batch.source_key}
            <span
              className={`admin-badge admin-badge--trailing ${STATUS_BADGE[batch.status].className}`}
            >
              {STATUS_BADGE[batch.status].label}
            </span>
          </h2>
          <p className="journal-import__meta">
            {batch.file_name}
            {batch.metric_year ? ` · metrics for ${batch.metric_year}` : ''} · read by{' '}
            {batch.created_by_name ?? '—'} on {formatDateTime(batch.created_at)}
            {isApplied &&
              ` · applied by ${batch.applied_by_name ?? '—'} on ${formatDateTime(batch.applied_at)}`}
          </p>
        </div>
        {batch.status === 'previewed' && (
          <div className="journal-import__batch-actions">
            <CustomButton
              variant="light"
              className="admin-btn-secondary"
              onClick={() => setConfirm('discard')}
              disabled={working}
            >
              Discard
            </CustomButton>
            <CustomButton onClick={() => setConfirm('apply')} loading={working}>
              Apply import
            </CustomButton>
          </div>
        )}
      </div>

      {summary.previouslyApplied && batch.status === 'previewed' && (
        <Alert variant="info" className="journal-import__notice">
          This file was already applied as import #{summary.previouslyApplied.id} on{' '}
          {formatDateTime(summary.previouslyApplied.appliedAt)}.{' '}
          {isPapers
            ? 'Applying it again only adds papers that are new, and credits staff whose Scopus ID was added since; everything else shows as no change.'
            : isStaff
              ? 'IDs already on file show as no change.'
              : 'Applying it again only fills in journals added to the list since then; everything else shows as no change.'}
        </Alert>
      )}

      <div className="journal-import__stats">
        {stats.map((stat) => (
          <div key={stat.label} className="journal-import__stat">
            <span className="journal-import__stat-label">{stat.label}</span>
            <span className="journal-import__stat-value">{stat.value.toLocaleString('en-IN')}</span>
          </div>
        ))}
      </div>

      {isReference && (
        <p className="journal-import__meta">
          This file lists {summary.rowsRead.toLocaleString('en-IN')} journals worldwide. Only the{' '}
          {matched.toLocaleString('en-IN')} in the KSRCT journal list are used; the other{' '}
          {skipped.toLocaleString('en-IN')} are skipped and not stored.
          {summary.journalsNotInFile
            ? ` ${summary.journalsNotInFile} journals in the KSRCT list are not in this file.`
            : ''}
        </p>
      )}

      {isPapers && summary.papers && countFor('add') > 0 && (
        <p className="journal-import__meta">
          Of the papers to add, {summary.papers.credited.toLocaleString('en-IN')} are credited to at
          least one staff member by their Scopus Author ID.{' '}
          {summary.papers.unassigned.toLocaleString('en-IN')} have no KSRCT author with a Scopus ID
          on file yet; they are kept unassigned and credited once that ID is added.
        </p>
      )}

      {isStaff && summary.staff && (
        <p className="journal-import__meta">
          The new Scopus IDs credit {summary.staff.papersToCredit.toLocaleString('en-IN')} imported
          papers to their staff members, as soon as the sheet is applied.
        </p>
      )}

      {leftOutTotal > 0 && (
        <p className="journal-import__meta">
          Left out:{' '}
          {leftOut
            .map(
              ([reason, count]) =>
                `${count.toLocaleString('en-IN')} — ${exclusionReasons[reason] ?? reason}`,
            )
            .join(' · ')}
        </p>
      )}

      {/* While the correction dialog is open its own copy is the one being read. */}
      {error && !correction && (
        <Alert variant="danger" className="journal-import__notice">
          {error}
          {failures.length > 0 && (
            <ul className="journal-import__failures">
              {failures.map((failure) => (
                <li key={failure.rowId}>
                  <strong>{failure.journalName}</strong>: {failure.reason}
                </li>
              ))}
            </ul>
          )}
        </Alert>
      )}

      <div className="admin-toolbar">
        <div className="admin-toolbar__filters">
          <CustomDropdown
            name="outcomeFilter"
            className="journal-import__filter"
            options={filterOptions}
            value={filterOptions.find((option) => option.value === outcome) ?? null}
            onChange={(option) => {
              setOutcome(((option as OptionType)?.value as OutcomeFilter) ?? 'all');
              setPage(1);
              setSelected(new Set());
            }}
          />
          <CustomInput
            name="rowSearch"
            className="journal-import__search"
            placeholder={
              isPapers
                ? 'Search paper title'
                : isStaff
                  ? 'Search staff name'
                  : 'Search journal name'
            }
            value={searchInput}
            onChange={setSearchInput}
          />
        </div>
        {selectable && (
          <div className="journal-import__bulk">
            <CustomCheckbox
              name="selectAllOpen"
              label={`Select all ${openExceptions.length} on this page`}
              checked={allOnPageSelected}
              onChange={(checked) =>
                setSelected(checked ? new Set(openExceptions.map((row) => row.id)) : new Set())
              }
            />
            <CustomButton
              variant="light"
              className="admin-btn-secondary"
              onClick={() => resolve('exclude', [...selected])}
              disabled={working || selected.size === 0}
            >
              Exclude {selected.size || ''}
            </CustomButton>
            <CustomButton
              onClick={() => resolve('accept', [...selected])}
              disabled={working || selected.size === 0}
            >
              Accept {selected.size || ''}
            </CustomButton>
          </div>
        )}
      </div>

      {!isApplied && countFor('exception') > 0 && batch.status === 'previewed' && (
        <p className="journal-import__meta">
          Rows that need review are not applied with the import. Once it is applied, accept, correct
          or exclude them here.
        </p>
      )}

      <div className="admin-card">
        <CustomTable
          columns={columns}
          data={rows}
          loading={loading}
          className={showActions ? '' : 'journal-import__table--no-actions'}
          emptyMessage={search ? `No ${noun} in this import match the search` : `No ${noun} here`}
          actions={showActions ? rowActions : undefined}
        />
      </div>

      <ImportPager
        page={page}
        perPage={PER_PAGE}
        total={total}
        onPage={setPage}
        disabled={loading}
      />

      <AlertModal
        show={confirm !== null}
        onHide={() => setConfirm(null)}
        type={confirm === 'discard' ? 'warning' : 'info'}
        title={confirm === 'discard' ? 'Discard this import?' : 'Apply this import?'}
        message={
          confirm === 'discard'
            ? 'Nothing from this file will be applied. The file is not kept, so it would have to be uploaded again.'
            : isStaff
              ? `${countFor('add')} staff members get new Scopus IDs and ${countFor('update')} have papers credited through an ID already on file; the imported papers those IDs appear on are credited to them. ${countFor('exception')} that need review stay here for you to accept or exclude.`
              : isPapers
                ? `${countFor('add')} papers will be added as approved publications and ${countFor('update')} publications already in the portal filled in, in one step. ${countFor('exception')} that need review stay here for you to accept or exclude.`
                : `${countFor('add')} journals will be added and ${countFor('update')} updated, in one step. ${countFor('exception')} that need review stay here for you to accept, correct or exclude.`
        }
        showCancel
        confirmText={confirm === 'discard' ? 'Discard' : 'Apply'}
        onConfirm={() => confirm && runAction(confirm)}
      />

      <CustomModal
        show={correction !== null}
        onHide={() => setCorrection(null)}
        size="sm"
        className="admin-modal"
        title="Correct and accept"
        footer={
          <>
            <CustomButton
              variant="light"
              className="admin-btn-secondary"
              onClick={() => setCorrection(null)}
              disabled={working}
            >
              Cancel
            </CustomButton>
            <CustomButton onClick={submitCorrection} loading={working}>
              Accept
            </CustomButton>
          </>
        }
      >
        {correction && (
          <div className="journal-import__correction">
            {error && (
              <Alert variant="danger" className="journal-import__notice">
                {error}
              </Alert>
            )}
            <p className="journal-import__reason">{correction.row.reason}</p>
            {correction.row.payload.action === 'add' ? (
              <CustomInput
                name="correctionName"
                label="Journal name"
                value={correction.journal_name}
                onChange={(value) => setCorrection({ ...correction, journal_name: value })}
                required
              />
            ) : (
              <p className="journal-import__meta">
                Updates “{correction.row.journal_name}” in the journal list. Leave a field empty to
                keep what the list has.
              </p>
            )}
            <CustomInput
              name="correctionPrintIssn"
              label="Print ISSN"
              placeholder="0000-0000"
              value={correction.print_issn}
              onChange={(value) => setCorrection({ ...correction, print_issn: value })}
            />
            <CustomInput
              name="correctionOnlineIssn"
              label="Online ISSN"
              placeholder="0000-0000"
              value={correction.online_issn}
              onChange={(value) => setCorrection({ ...correction, online_issn: value })}
            />
            <CustomDropdown
              name="correctionLevel"
              label="Level"
              placeholder="Keep as it is"
              options={LEVEL_OPTIONS}
              value={LEVEL_OPTIONS.find((option) => option.value === correction.category) ?? null}
              onChange={(option) =>
                setCorrection({
                  ...correction,
                  category: String((option as OptionType)?.value ?? ''),
                })
              }
              isClearable
            />
          </div>
        )}
      </CustomModal>
    </div>
  );
};

export default ImportBatchView;
