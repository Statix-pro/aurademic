import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-bootstrap';

import { errorMessage } from './importLabels';
import ImportPager from './ImportPager';
import CustomDropdown, { OptionType } from '../../../shared/components/ui/CustomDropdown';
import CustomInput from '../../../shared/components/ui/CustomInput';
import CustomTable from '../../../shared/components/ui/CustomTable';
import authenticityUtility from '../../../shared/utils/authenticityUtility';

import type { ApiEnvelope, JournalFilter, JournalListRow, Paged } from './types';

const PER_PAGE = 25;

const FILTER_LABELS: Record<JournalFilter, string> = {
  if_needed: 'Impact Factor needed',
  no_quartile: 'No quartile',
  discontinued: 'Discontinued by Scopus',
  not_scopus: 'Not in Scopus',
  wos: 'Web of Science',
  national: 'National',
};

type Counts = Record<JournalFilter | 'total', number>;

const LEVEL_SOURCE_NOTE: Record<string, string> = {
  auto: 'default',
  faculty: 'faculty sheet',
  admin: 'admin',
};

/**
 * The KSRCT journal list as the imports have built it, with each journal's newest metrics and
 * where they came from — and the gaps to close, such as journals still waiting for an Impact
 * Factor.
 */
const JournalList: React.FC = () => {
  const [rows, setRows] = useState<JournalListRow[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<JournalFilter | ''>('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = (await authenticityUtility.get('/journal-catalog/journals', {
        params: {
          filter: filter || undefined,
          search: search || undefined,
          page,
          per_page: PER_PAGE,
        },
      })) as ApiEnvelope<Paged<JournalListRow> & { counts: Counts }>;
      setRows(response.data?.rows ?? []);
      setTotal(response.data?.total ?? 0);
      setCounts(response.data?.counts ?? null);
      setError('');
    } catch (err) {
      setRows([]);
      setError(errorMessage(err, 'Failed to load the journal list.'));
    } finally {
      setLoading(false);
    }
  }, [filter, search, page]);

  useEffect(() => {
    load();
  }, [load]);

  const filterOptions: OptionType[] = useMemo(
    () => [
      { value: '', label: `All journals${counts ? ` (${counts.total})` : ''}` },
      ...(Object.keys(FILTER_LABELS) as JournalFilter[]).map((key) => ({
        value: key,
        label: `${FILTER_LABELS[key]}${counts ? ` (${counts[key]})` : ''}`,
      })),
    ],
    [counts],
  );

  const columns = [
    {
      key: 'journal_name',
      label: 'Journal',
      style: { width: '34%' },
      render: (row: JournalListRow) => (
        <>
          <span className="admin-name">{row.journal_name}</span>
          {Boolean(row.scopus_discontinued) && (
            <span className="admin-badge admin-badge--trailing journal-import__badge--warn">
              Discontinued by Scopus
            </span>
          )}
          {!row.scopus_status && (
            <span className="admin-badge admin-badge--trailing admin-badge--muted">
              Not in Scopus
            </span>
          )}
          {Boolean(row.wos_indexed) && (
            <span className="admin-badge admin-badge--trailing admin-badge--info">WoS</span>
          )}
          {row.publisher && <span className="journal-import__secondary">{row.publisher}</span>}
        </>
      ),
    },
    {
      key: 'issn',
      label: 'ISSN',
      render: (row: JournalListRow) => (
        <span className="journal-import__issn">
          {[row.print_issn, row.online_issn].filter(Boolean).join(' · ') || '—'}
        </span>
      ),
    },
    {
      key: 'category',
      label: 'Level',
      render: (row: JournalListRow) => (
        <>
          <span>{row.category}</span>
          {row.level_source && (
            <span className="journal-import__secondary">{LEVEL_SOURCE_NOTE[row.level_source]}</span>
          )}
        </>
      ),
    },
    {
      key: 'quartile',
      label: 'Quartile',
      render: (row: JournalListRow) =>
        row.quartile ? (
          <>
            <span>{row.quartile}</span>
            <span className="journal-import__secondary">
              {row.quartile_year} · SJR {row.sjr ?? '—'}
            </span>
          </>
        ) : (
          <span className="admin-muted">—</span>
        ),
    },
    {
      key: 'impact_factor',
      label: 'Impact Factor',
      render: (row: JournalListRow) =>
        row.impact_factor !== null ? (
          <>
            <span>{Number(row.impact_factor)}</span>
            {row.impact_factor_year && (
              <span className="journal-import__secondary">{row.impact_factor_year}</span>
            )}
          </>
        ) : (
          <span className="admin-badge journal-import__badge--warn">Needed</span>
        ),
    },
    {
      key: 'cite_score',
      label: 'CiteScore',
      render: (row: JournalListRow) =>
        row.cite_score !== null ? Number(row.cite_score) : <span className="admin-muted">—</span>,
    },
  ];

  return (
    <>
      <div className="admin-toolbar">
        <div className="admin-toolbar__filters">
          <CustomDropdown
            name="journalFilter"
            className="journal-import__filter"
            options={filterOptions}
            value={filterOptions.find((option) => option.value === filter) ?? filterOptions[0]}
            onChange={(option) => {
              setFilter(((option as OptionType)?.value as JournalFilter) ?? '');
              setPage(1);
            }}
          />
          <CustomInput
            name="journalSearch"
            className="journal-import__search"
            placeholder="Search name or ISSN"
            value={searchInput}
            onChange={setSearchInput}
          />
        </div>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <div className="admin-card">
        <CustomTable
          columns={columns}
          data={rows}
          loading={loading}
          className="journal-import__table--no-actions"
          emptyMessage={
            search || filter
              ? 'No journal matches'
              : 'The journal list is empty — import a file first'
          }
        />
      </div>

      <ImportPager
        page={page}
        perPage={PER_PAGE}
        total={total}
        onPage={setPage}
        disabled={loading}
      />

      <p className="journal-import__credit">
        Quartile and SJR: SCImago Journal &amp; Country Rank (scimagojr.com), used with permission.
        Impact Factor values are as entered in the KSRCT journal master sheet or by faculty.
      </p>
    </>
  );
};

export default JournalList;
