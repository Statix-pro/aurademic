import { ChevronDown, ChevronUp } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { Form } from 'react-bootstrap';
import Select from 'react-select';

import { useAuth } from '../../../contexts/AuthContext';
import CustomInput from '../../../shared/components/ui/CustomInput';
import authenticityUtility from '../../../shared/utils/authenticityUtility';
import { isSuperAdmin } from '../../../shared/utils/permissionUtils';
import './expenditurereport.css';

type Option = {
  value: string;
  label: string;
  /** Compact form for the month strip's pills, where the full label will not fit. */
  shortLabel?: string;
  category?: 'Type' | 'Entity';
  id?: number | string;
};

/** The six money columns every table on this page shares. */
type MetricKey =
  | 'advance'
  | 'settlement'
  | 'expenditure'
  | 'totalSpent'
  | 'unsettledAdvance'
  | 'pending';

type Metrics = Record<MetricKey, number> & { requestCount: number };

type HeadRow = Metrics & { budgetHead: string };

type DetailRow = Metrics & {
  expenditureId: number;
  requestRef: string;
  applicantName: string;
  beneficiaryLabel: string;
  beneficiaryType: string;
  subHead: string;
  requestType: string;
  requestDate: string | null;
  status: string;
};

type BeneficiaryRow = Metrics & {
  beneficiaryKey: string;
  beneficiaryLabel: string;
  beneficiaryTypeKey: string;
  beneficiaryTypeLabel: string;
};

type MonthColumn = { key: string; label: string };

type MonthlyRow = {
  budgetHead: string;
  byMonth: Record<string, Metrics | undefined>;
};

type PeriodMode = 'year' | 'month' | 'range';
type TabKey = 'head' | 'beneficiary' | 'monthly';

const AMOUNT_COLUMNS: Array<{ key: MetricKey; label: string; hint: string }> = [
  { key: 'advance', label: 'Advance', hint: 'Cash advanced out on approved requests' },
  { key: 'settlement', label: 'Settlement', hint: 'Actual spend accounted against advances' },
  { key: 'expenditure', label: 'Expenditure', hint: 'Direct expenditure with no advance' },
  { key: 'totalSpent', label: 'Total Spent', hint: 'Settlement + direct expenditure' },
  { key: 'unsettledAdvance', label: 'Unsettled Adv.', hint: 'Advance not yet settled' },
  { key: 'pending', label: 'Pending', hint: 'Amount still awaiting approval' },
];

/** Metrics the Month-wise table can put in its cells. */
const MONTH_METRIC_OPTIONS: Option[] = [
  { value: 'totalSpent', label: 'Total Spent' },
  { value: 'advance', label: 'Advance' },
  { value: 'settlement', label: 'Settlement' },
  { value: 'expenditure', label: 'Direct Expenditure' },
];

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'head', label: 'Budget Head' },
  { key: 'beneficiary', label: 'Beneficiary Summary' },
  { key: 'monthly', label: 'Month-wise' },
];

/**
 * Period modes are a segmented control rather than a dropdown: three mutually exclusive
 * choices that change which other controls appear, which a closed dropdown hides.
 */
const PERIOD_MODES: Array<{ key: PeriodMode; label: string }> = [
  { key: 'year', label: 'Full year' },
  { key: 'month', label: 'Month' },
  { key: 'range', label: 'Date range' },
];

const ALL_BENEFICIARY_OPTION: Option = { value: 'all', label: 'All Beneficiary' };

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const BENEFICIARY_TYPE_ORDER = [
  'Department',
  'Centre',
  'Cell',
  'Club',
  'Section',
  'Professional Body',
];

const RUPEE = '₹';

const EMPTY_METRICS: Metrics = {
  advance: 0,
  settlement: 0,
  expenditure: 0,
  totalSpent: 0,
  unsettledAdvance: 0,
  pending: 0,
  requestCount: 0,
};

/**
 * Fiscal year starting in April — the convention every expenditure and finance fiscal-year
 * expression on the server already uses, so the year picked here selects the same set of
 * requests the approval queues would.
 */
const getCurrentFiscalYearStart = (): number => {
  const now = new Date();
  return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
};

const fiscalYearLabel = (start: number) => `FY ${start}-${String(start + 1).slice(2)}`;

/**
 * The twelve months of a fiscal year, April through the following March. Each pill carries the
 * two-digit year because a fiscal year straddles two of them — "Mar 27" is not "Mar 26".
 */
const buildMonthOptions = (fiscalYearStart: number): Option[] =>
  Array.from({ length: 12 }, (_, offset) => {
    const absolute = fiscalYearStart * 12 + 3 + offset;
    const year = Math.floor(absolute / 12);
    const monthIndex = absolute % 12;
    return {
      value: `${year}-${String(monthIndex + 1).padStart(2, '0')}`,
      label: `${MONTH_NAMES[monthIndex]} ${year}`,
      shortLabel: `${MONTH_NAMES[monthIndex].slice(0, 3)} ${String(year).slice(2)}`,
    };
  });

/** Inclusive first/last day of a `YYYY-MM` value, as the date inputs and API expect. */
const monthBounds = (monthValue: string) => {
  const [year, month] = monthValue.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return {
    dateFrom: `${monthValue}-01`,
    dateTo: `${monthValue}-${String(lastDay).padStart(2, '0')}`,
  };
};

const formatINR = (value: number) => Number(value || 0).toLocaleString('en-IN');

const formatAmount = (value: number) =>
  Number(value || 0) === 0 ? '—' : `${RUPEE}${formatINR(value)}`;

const formatDate = (value: string | null) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value).slice(0, 10);
  return parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const sumMetrics = (rows: Metrics[]): Metrics =>
  rows.reduce<Metrics>(
    (accumulator, row) => ({
      advance: accumulator.advance + Number(row.advance || 0),
      settlement: accumulator.settlement + Number(row.settlement || 0),
      expenditure: accumulator.expenditure + Number(row.expenditure || 0),
      totalSpent: accumulator.totalSpent + Number(row.totalSpent || 0),
      // Per-row unsettled amounts are summed rather than recomputed from the totals: a head
      // that over-settled must not cancel out another head's outstanding advance.
      unsettledAdvance: accumulator.unsettledAdvance + Number(row.unsettledAdvance || 0),
      pending: accumulator.pending + Number(row.pending || 0),
      requestCount: accumulator.requestCount + Number(row.requestCount || 0),
    }),
    { ...EMPTY_METRICS },
  );

// Matches the budget report's select styling so the two reports read as one system.
const selectStyles = {
  control: (base: any, state: any) => ({
    ...base,
    minHeight: '42px',
    borderRadius: '12px',
    borderColor: state.isFocused ? '#0069ab' : 'rgba(15, 23, 42, 0.18)',
    background: state.isDisabled ? 'rgba(241, 245, 249, 0.9)' : 'rgba(255, 255, 255, 0.92)',
    boxShadow: state.isFocused
      ? '0 0 0 4px rgba(0, 105, 171, 0.15), 0 10px 22px rgba(2, 6, 23, 0.08)'
      : '0 6px 18px rgba(2, 6, 23, 0.06)',
    borderWidth: '1px',
    fontFamily: 'inherit',
    fontSize: '0.95rem',
    fontWeight: 500,
    transition: 'all 0.2s ease',
    cursor: 'pointer',
    '&:hover': {
      borderColor: state.isFocused ? '#0069ab' : 'rgba(15, 23, 42, 0.3)',
    },
  }),
  placeholder: (base: any) => ({ ...base, color: '#64748b' }),
  singleValue: (base: any) => ({ ...base, color: '#0f172a' }),
  menu: (base: any) => ({
    ...base,
    borderRadius: '12px',
    marginTop: '0px',
    overflow: 'hidden',
    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
    zIndex: 999,
    border: '1px solid #eef2f6',
  }),
  option: (base: any, state: any) => ({
    ...base,
    backgroundColor: state.isSelected ? '#0069ab' : state.isFocused ? '#f1f5f9' : 'transparent',
    color: state.isSelected ? '#ffffff' : '#1e293b',
    padding: '10px 15px',
    fontSize: '0.9rem',
    cursor: 'pointer',
    '&:active': { backgroundColor: '#0069ab' },
  }),
  groupHeading: (base: any) => ({
    ...base,
    fontSize: '0.72rem',
    fontWeight: 800,
    textTransform: 'uppercase',
    color: '#475569',
    backgroundColor: '#f1f5f9',
    padding: '8px 12px',
    margin: '0',
    borderBottom: '1px solid #e2e8f0',
    letterSpacing: '0.05em',
  }),
};

const SCOPE_LABELS: Record<string, string> = {
  global: 'All beneficiaries',
  department: 'Your departments',
  entity: 'Your entities',
  own: 'Your requests only',
};

const ExpenditureReport: React.FC = () => {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<TabKey>('head');

  const currentFiscalYearStart = useMemo(() => getCurrentFiscalYearStart(), []);
  const [fiscalYear, setFiscalYear] = useState<Option>({
    value: String(currentFiscalYearStart),
    label: fiscalYearLabel(currentFiscalYearStart),
  });
  const [fiscalYearOptions, setFiscalYearOptions] = useState<Option[]>([]);

  const [periodMode, setPeriodMode] = useState<PeriodMode>('year');
  const [month, setMonth] = useState<Option | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [beneficiary, setBeneficiary] = useState<Option>(ALL_BENEFICIARY_OPTION);
  const [beneficiaryTypes, setBeneficiaryTypes] = useState<string[]>([]);
  const [orgUnits, setOrgUnits] = useState<any[]>([]);

  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [headRows, setHeadRows] = useState<HeadRow[]>([]);
  const [detailsByHead, setDetailsByHead] = useState<Record<string, DetailRow[]>>({});
  const [beneficiaryRows, setBeneficiaryRows] = useState<BeneficiaryRow[]>([]);
  const [monthColumns, setMonthColumns] = useState<MonthColumn[]>([]);
  const [monthlyRows, setMonthlyRows] = useState<MonthlyRow[]>([]);
  const [monthColumnsTruncated, setMonthColumnsTruncated] = useState(false);
  const [monthMetric, setMonthMetric] = useState<Option>(MONTH_METRIC_OPTIONS[0]);

  const [scopeType, setScopeType] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [expandedHead, setExpandedHead] = useState<string | null>(null);
  const [detailSubHeadFilter, setDetailSubHeadFilter] = useState('');
  const [isAllExpanded, setIsAllExpanded] = useState(true);
  const [expandedByType, setExpandedByType] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(searchText), 500);
    return () => clearTimeout(handle);
  }, [searchText]);

  const userRoleLabel = useMemo(() => {
    if (isSuperAdmin(user)) return 'Super Admin';

    const roleCodes = (Array.isArray(user?.roles) ? user.roles : [])
      .map((role: any) => {
        if (!role) return '';
        if (typeof role === 'string') return role;
        return role.role_code || role.role_name || '';
      })
      .map((role) => String(role).toLowerCase());

    if (roleCodes.some((code) => code.includes('principal'))) return 'Principal';
    if (roleCodes.some((code) => code.includes('dof'))) return 'DOF';
    if (roleCodes.some((code) => code.includes('coordinator'))) return 'Coordinator';
    if (roleCodes.some((code) => code.includes('hod') || code.includes('head'))) return 'HOD';
    if (roleCodes.some((code) => code.includes('admin'))) return 'Admin';
    return 'User';
  }, [user]);

  // Fiscal years and beneficiary types come from the expenditure workflow meta endpoint the
  // approval queues already use, so the report's year list matches theirs exactly.
  useEffect(() => {
    const fetchMeta = async () => {
      const fallbackYears = [
        currentFiscalYearStart,
        currentFiscalYearStart - 1,
        currentFiscalYearStart - 2,
      ];

      try {
        const response: any = await authenticityUtility.get('/expenditure/workflow/meta');
        const years: number[] = Array.isArray(response?.data?.availableFiscalYears)
          ? response.data.availableFiscalYears
              .map((year: unknown) => Number.parseInt(String(year), 10))
              .filter((year: number) => Number.isInteger(year) && year > 0)
          : [];
        const types: string[] = Array.isArray(response?.data?.availableBeneficiaryTypes)
          ? response.data.availableBeneficiaryTypes
              .map((type: unknown) => String(type))
              .filter(Boolean)
          : [];

        const resolvedYears = years.length ? years : fallbackYears;
        setFiscalYearOptions(
          [...new Set([...resolvedYears, currentFiscalYearStart])]
            .sort((a, b) => b - a)
            .map((year) => ({ value: String(year), label: fiscalYearLabel(year) })),
        );
        setBeneficiaryTypes(types);
      } catch (fetchError) {
        console.error('Failed to fetch expenditure report meta', fetchError);
        setFiscalYearOptions(
          fallbackYears.map((year) => ({ value: String(year), label: fiscalYearLabel(year) })),
        );
      }
    };

    fetchMeta();
  }, [currentFiscalYearStart]);

  useEffect(() => {
    const fetchOrgUnits = async () => {
      try {
        const response: any = await authenticityUtility.get('/adminbudget/org-units');
        setOrgUnits(response?.data?.all || response?.data?.data?.all || []);
      } catch (fetchError) {
        console.error('Failed to fetch org units', fetchError);
        setOrgUnits([]);
      }
    };

    fetchOrgUnits();
  }, []);

  const monthOptions = useMemo(
    () => buildMonthOptions(Number.parseInt(fiscalYear.value, 10) || currentFiscalYearStart),
    [fiscalYear.value, currentFiscalYearStart],
  );

  // Switching fiscal year leaves a month from the old year selected, which would silently
  // report the wrong window — reset to that year's first month instead.
  useEffect(() => {
    if (periodMode !== 'month') return;
    setMonth((previous) => {
      if (previous && monthOptions.some((option) => option.value === previous.value)) {
        return previous;
      }
      return monthOptions[0] || null;
    });
  }, [monthOptions, periodMode]);

  const beneficiaryOptions = useMemo(() => {
    const typeOptions = beneficiaryTypes.map((type) => ({
      value: type,
      label: type,
      category: 'Type' as const,
    }));

    const entityGroups: Record<string, Option[]> = {};
    orgUnits.forEach((unit: any) => {
      const groupName = String(unit?.type_name || 'Other');
      const name = String(unit?.name || '').trim();
      if (!name) return;
      if (!entityGroups[groupName]) entityGroups[groupName] = [];
      entityGroups[groupName].push({
        value: name,
        label: name,
        id: unit?.id,
        category: 'Entity',
      });
    });

    const groupedEntities = Object.keys(entityGroups)
      .sort()
      .map((groupName) => ({
        label: groupName,
        options: entityGroups[groupName].sort((a, b) => a.label.localeCompare(b.label)),
      }));

    return [
      ALL_BENEFICIARY_OPTION,
      ...(typeOptions.length ? [{ label: 'Beneficiary type', options: typeOptions }] : []),
      ...groupedEntities,
    ];
  }, [beneficiaryTypes, orgUnits]);

  // A reversed range is flagged here rather than silently swapped, even though the server
  // tolerates either order.
  const dateError = useMemo(() => {
    if (periodMode !== 'range') return '';
    if (dateFrom && dateTo && dateFrom > dateTo) return 'The "from" date is after the "to" date.';
    return '';
  }, [periodMode, dateFrom, dateTo]);

  /**
   * The period modes are mutually exclusive on purpose: a free date range drops fiscalYear so
   * it can span fiscal years, while Month sends both so the month is read inside its year.
   */
  const requestParams = useMemo(() => {
    const params: Record<string, string> = {};

    if (periodMode === 'range') {
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
    } else {
      params.fiscalYear = fiscalYear.value;

      if (periodMode === 'month' && month?.value) {
        const bounds = monthBounds(month.value);
        params.dateFrom = bounds.dateFrom;
        params.dateTo = bounds.dateTo;
      }
    }

    if (beneficiary.category === 'Type') params.beneficiaryType = beneficiary.value;
    if (beneficiary.category === 'Entity') params.beneficiaryValue = beneficiary.value;
    if (debouncedSearch.trim()) params.q = debouncedSearch.trim();

    return params;
  }, [periodMode, fiscalYear.value, month?.value, dateFrom, dateTo, beneficiary, debouncedSearch]);

  const requestParamsKey = JSON.stringify(requestParams);

  useEffect(() => {
    if (dateError) return;

    const params = JSON.parse(requestParamsKey);
    let cancelled = false;

    const endpoint =
      activeTab === 'head'
        ? '/expenditure-report/consolidation'
        : activeTab === 'beneficiary'
          ? '/expenditure-report/beneficiary-summary'
          : '/expenditure-report/monthly';

    const fetchTabData = async () => {
      try {
        setLoading(true);
        setError('');

        const response: any = await authenticityUtility.get(endpoint, { params });
        if (cancelled) return;

        if (response?.success === false) {
          throw new Error(response?.message || 'Failed to load the expenditure report.');
        }

        setScopeType(String(response?.scopeType || ''));

        if (activeTab === 'head') {
          setHeadRows(
            Array.isArray(response?.data?.consolidatedRows) ? response.data.consolidatedRows : [],
          );
          setDetailsByHead(response?.data?.detailsByHead || {});
        } else if (activeTab === 'beneficiary') {
          setBeneficiaryRows(Array.isArray(response?.data) ? response.data : []);
        } else {
          setMonthColumns(Array.isArray(response?.data?.months) ? response.data.months : []);
          setMonthlyRows(Array.isArray(response?.data?.rows) ? response.data.rows : []);
          setMonthColumnsTruncated(Boolean(response?.data?.monthColumnsTruncated));
        }
      } catch (fetchError: any) {
        if (cancelled) return;
        console.error('Failed to load expenditure report', fetchError);
        setError(
          fetchError?.response?.data?.message ||
            fetchError?.message ||
            'Failed to load the expenditure report.',
        );
        if (activeTab === 'head') {
          setHeadRows([]);
          setDetailsByHead({});
        } else if (activeTab === 'beneficiary') {
          setBeneficiaryRows([]);
        } else {
          setMonthColumns([]);
          setMonthlyRows([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchTabData();

    return () => {
      cancelled = true;
    };
  }, [activeTab, requestParamsKey, dateError]);

  const headTotals = useMemo(() => sumMetrics(headRows), [headRows]);

  useEffect(() => {
    if (expandedHead && !detailsByHead[expandedHead]) {
      setExpandedHead(null);
    }
  }, [detailsByHead, expandedHead]);

  useEffect(() => {
    setDetailSubHeadFilter('');
  }, [expandedHead]);

  const filteredDetails = useMemo(() => {
    if (!expandedHead) return [];
    const rows = detailsByHead[expandedHead] || [];
    const query = detailSubHeadFilter.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter(
      (row) =>
        row.subHead.toLowerCase().includes(query) ||
        row.requestRef.toLowerCase().includes(query) ||
        row.applicantName.toLowerCase().includes(query),
    );
  }, [expandedHead, detailsByHead, detailSubHeadFilter]);

  const beneficiarySections = useMemo(() => {
    const grouped = new Map<string, BeneficiaryRow[]>();
    beneficiaryRows.forEach((row) => {
      const typeLabel = row.beneficiaryTypeLabel || 'Unknown';
      if (!grouped.has(typeLabel)) grouped.set(typeLabel, []);
      grouped.get(typeLabel)!.push(row);
    });

    const ordered = BENEFICIARY_TYPE_ORDER.filter((type) => grouped.has(type)).map((type) => ({
      type,
      rows: grouped.get(type)!,
    }));
    const remaining = [...grouped.entries()]
      .filter(([type]) => !BENEFICIARY_TYPE_ORDER.includes(type))
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([type, rows]) => ({ type, rows }));

    return [...ordered, ...remaining];
  }, [beneficiaryRows]);

  const beneficiaryTotals = useMemo(() => sumMetrics(beneficiaryRows), [beneficiaryRows]);

  useEffect(() => {
    if (!beneficiarySections.length) return;
    setExpandedByType((previous) => {
      const next: Record<string, boolean> = {};
      beneficiarySections.forEach(({ type }) => {
        next[type] = previous[type] ?? isAllExpanded;
      });
      return next;
    });
  }, [beneficiarySections, isAllExpanded]);

  const toggleAllSections = () => {
    const nextExpanded = !isAllExpanded;
    setIsAllExpanded(nextExpanded);
    setExpandedByType(
      Object.fromEntries(beneficiarySections.map(({ type }) => [type, nextExpanded])),
    );
  };

  const toggleSection = (type: string) => {
    setExpandedByType((previous) => {
      const next = { ...previous, [type]: !(previous[type] ?? isAllExpanded) };
      setIsAllExpanded(beneficiarySections.every(({ type: sectionType }) => next[sectionType]));
      return next;
    });
  };

  const monthMetricKey = monthMetric.value as MetricKey;

  const monthlyTotalsByMonth = useMemo(() => {
    const totals: Record<string, number> = {};
    monthColumns.forEach(({ key }) => {
      totals[key] = monthlyRows.reduce(
        (sum, row) => sum + Number(row.byMonth?.[key]?.[monthMetricKey] || 0),
        0,
      );
    });
    return totals;
  }, [monthColumns, monthlyRows, monthMetricKey]);

  const monthlyRowTotal = (row: MonthlyRow) =>
    monthColumns.reduce(
      (sum, { key }) => sum + Number(row.byMonth?.[key]?.[monthMetricKey] || 0),
      0,
    );

  const monthlyGrandTotal = useMemo(
    () => Object.values(monthlyTotalsByMonth).reduce((sum, value) => sum + value, 0),
    [monthlyTotalsByMonth],
  );

  const periodSummary = useMemo(() => {
    if (periodMode === 'month') return month?.label || 'Month';
    if (periodMode === 'range') {
      if (!dateFrom && !dateTo) return 'All dates';
      if (dateFrom && dateTo) return `${formatDate(dateFrom)} → ${formatDate(dateTo)}`;
      return dateFrom ? `From ${formatDate(dateFrom)}` : `Up to ${formatDate(dateTo)}`;
    }
    return fiscalYear.label;
  }, [periodMode, month?.label, dateFrom, dateTo, fiscalYear.label]);

  const renderAmountHeaders = () =>
    AMOUNT_COLUMNS.map((column) => (
      <th key={column.key} title={column.hint}>
        {column.label}
      </th>
    ));

  const renderAmountCells = (row: Metrics, bold = false) =>
    AMOUNT_COLUMNS.map((column) => (
      <td key={column.key}>
        {bold ? <strong>{formatAmount(row[column.key])}</strong> : formatAmount(row[column.key])}
      </td>
    ));

  const showEmptyState = !loading && !error;

  return (
    <div className="expenditurereport-page">
      <div className="expenditurereport-container">
        {/*
          Deliberately NOT using the global `category-toggle-container` class: it is sized for
          exactly two tabs (width: 250px, button width: 50% in journalform.css), so a third tab
          overflowed the pill background. This toggle sizes to its content instead.
        */}
        <div className="expenditurereport-tabs-wrap">
          <div className="expenditurereport-tab-toggle" role="tablist">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.key}
                className={activeTab === tab.key ? 'active' : ''}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="expenditurereport-card">
          <div className="expenditurereport-header">
            <div className="expenditurereport-header-left">
              <h1 className="expenditurereport-title">Expenditure Report</h1>
              <span className="expenditurereport-role-pill">{userRoleLabel}</span>
              {scopeType && SCOPE_LABELS[scopeType] && (
                <span className="expenditurereport-scope-pill">{SCOPE_LABELS[scopeType]}</span>
              )}
            </div>

            <div className="expenditurereport-header-right">
              <div className="expenditurereport-filter expenditurereport-filter--search">
                <Form.Control
                  type="text"
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="Search ref, applicant or head"
                  className="expenditurereport-search"
                />
              </div>
            </div>
          </div>

          {/*
            One toolbar for the whole period choice, so the controls read as a sentence
            ("FY 2026-27, month of May") instead of a row of unlabelled dropdowns.
          */}
          <div className="expenditurereport-toolbar">
            <div className="expenditurereport-field expenditurereport-field--fy">
              <label className="expenditurereport-field-label" htmlFor="expenditure-report-fy">
                Financial year
              </label>
              <Select
                inputId="expenditure-report-fy"
                options={fiscalYearOptions}
                value={fiscalYear}
                onChange={(option) => option && setFiscalYear(option as Option)}
                styles={selectStyles}
                isSearchable={false}
                // A free date range spans fiscal years, so the year picker has no meaning there.
                isDisabled={periodMode === 'range'}
                placeholder="Financial Year"
              />
            </div>

            <div className="expenditurereport-field">
              <span className="expenditurereport-field-label">Period</span>
              <div className="expenditurereport-segmented" role="group" aria-label="Period">
                {PERIOD_MODES.map((mode) => (
                  <button
                    key={mode.key}
                    type="button"
                    aria-pressed={periodMode === mode.key}
                    className={periodMode === mode.key ? 'active' : ''}
                    onClick={() => setPeriodMode(mode.key)}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="expenditurereport-field expenditurereport-field--beneficiary">
              <label
                className="expenditurereport-field-label"
                htmlFor="expenditure-report-beneficiary"
              >
                Beneficiary
              </label>
              <Select
                inputId="expenditure-report-beneficiary"
                options={beneficiaryOptions}
                value={beneficiary}
                onChange={(option) => setBeneficiary((option as Option) || ALL_BENEFICIARY_OPTION)}
                styles={selectStyles}
                isSearchable
                placeholder="Search Beneficiary..."
                classNamePrefix="react-select"
              />
            </div>
          </div>

          {/*
            The twelve months as a strip rather than a dropdown: the fiscal year only ever has
            twelve, and showing them all makes the whole year scannable and one click away.
          */}
          {periodMode === 'month' && (
            <div className="expenditurereport-monthstrip-row">
              <span className="expenditurereport-field-label">Month</span>
              <div className="expenditurereport-monthstrip" role="group" aria-label="Month">
                {monthOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={month?.value === option.value}
                    className={month?.value === option.value ? 'active' : ''}
                    onClick={() => setMonth(option)}
                  >
                    {option.shortLabel || option.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {periodMode === 'range' && (
            <div className="expenditurereport-range-row">
              <CustomInput
                label="From date"
                name="expenditureReportDateFrom"
                type="date"
                value={dateFrom}
                onChange={setDateFrom}
                className="expenditurereport-date-input"
              />
              <CustomInput
                label="To date"
                name="expenditureReportDateTo"
                type="date"
                value={dateTo}
                onChange={setDateTo}
                error={dateError}
                className="expenditurereport-date-input"
              />
              <p className="expenditurereport-range-note">
                Both bounds are inclusive and the range is searched across all fiscal years. Leaving
                them empty reports on every date on record.
              </p>
            </div>
          )}

          <div className="expenditurereport-body">
            <div className="expenditurereport-period-summary">
              Showing <strong>{periodSummary}</strong>
              {activeTab === 'monthly' && (
                <span className="expenditurereport-metric-inline">
                  <span>Cell metric</span>
                  <Select
                    options={MONTH_METRIC_OPTIONS}
                    value={monthMetric}
                    onChange={(option) => option && setMonthMetric(option as Option)}
                    styles={selectStyles}
                    isSearchable={false}
                    className="expenditurereport-metric-select"
                  />
                </span>
              )}
            </div>

            {loading && <div className="expenditurereport-state">Loading...</div>}
            {!loading && error && (
              <div className="expenditurereport-state expenditurereport-state--error">{error}</div>
            )}
            {!loading && !error && dateError && (
              <div className="expenditurereport-state expenditurereport-state--error">
                {dateError}
              </div>
            )}

            {/* ── Tab 1: budget head ─────────────────────────────────────── */}
            {activeTab === 'head' && showEmptyState && headRows.length > 0 && (
              <>
                <div className="expenditurereport-table-wrapper">
                  <table className="expenditurereport-table">
                    <thead>
                      <tr>
                        <th>S.No</th>
                        <th>Budget Head</th>
                        {renderAmountHeaders()}
                      </tr>
                    </thead>
                    <tbody>
                      {headRows.map((row, index) => {
                        const isSelected = expandedHead === row.budgetHead;
                        return (
                          <tr
                            key={`${row.budgetHead}-${index}`}
                            className={`expenditurereport-row-clickable${isSelected ? ' expenditurereport-row-selected' : ''}`}
                            onClick={() =>
                              setExpandedHead((previous) =>
                                previous === row.budgetHead ? null : row.budgetHead,
                              )
                            }
                            aria-selected={isSelected}
                          >
                            <td>{index + 1}</td>
                            <td>
                              <button
                                type="button"
                                className="expenditurereport-row-toggle-btn"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setExpandedHead((previous) =>
                                    previous === row.budgetHead ? null : row.budgetHead,
                                  );
                                }}
                                aria-expanded={isSelected}
                                aria-label={`Toggle details for ${row.budgetHead}`}
                              >
                                {row.budgetHead}
                              </button>
                            </td>
                            {renderAmountCells(row)}
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="expenditurereport-total-row">
                        <td />
                        <td>
                          <strong>Total</strong>
                        </td>
                        {renderAmountCells(headTotals, true)}
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {expandedHead && (
                  <div className="expenditurereport-detail-section">
                    <div className="expenditurereport-detail-header">
                      <div className="expenditurereport-detail-title">{expandedHead}</div>
                      <input
                        type="text"
                        value={detailSubHeadFilter}
                        onChange={(event) => setDetailSubHeadFilter(event.target.value)}
                        className="expenditurereport-detail-filter-input"
                        placeholder="Filter by sub head, ref or applicant..."
                      />
                    </div>
                    <div className="expenditurereport-detail-table-wrapper">
                      <table className="expenditurereport-detail-table">
                        <thead>
                          <tr>
                            <th>Request</th>
                            <th>Date</th>
                            <th>Applicant</th>
                            <th>Beneficiary</th>
                            <th>Sub Head</th>
                            <th>Type</th>
                            <th>Advance</th>
                            <th>Settlement</th>
                            <th>Expenditure</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredDetails.map((row, index) => (
                            <tr key={`${row.expenditureId}-${row.subHead}-${index}`}>
                              <td className="expenditurereport-detail-ref">{row.requestRef}</td>
                              <td>{formatDate(row.requestDate)}</td>
                              <td>{row.applicantName}</td>
                              <td>{row.beneficiaryLabel || '—'}</td>
                              <td>{row.subHead}</td>
                              <td>{row.requestType}</td>
                              <td>{formatAmount(row.advance)}</td>
                              <td>{formatAmount(row.settlement)}</td>
                              <td>{formatAmount(row.expenditure)}</td>
                              <td>
                                <span
                                  className={`expenditurereport-status-pill expenditurereport-status-pill--${row.status}`}
                                >
                                  {row.status === 'approved' ? 'Approved' : 'In progress'}
                                </span>
                              </td>
                            </tr>
                          ))}
                          {filteredDetails.length === 0 && (
                            <tr>
                              <td colSpan={10} className="expenditurereport-detail-empty">
                                No matching request found.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}

            {activeTab === 'head' && showEmptyState && headRows.length === 0 && (
              <div className="expenditurereport-state">
                No expenditure recorded for the selected period.
              </div>
            )}

            {/* ── Tab 2: beneficiary summary ─────────────────────────────── */}
            {activeTab === 'beneficiary' && showEmptyState && beneficiaryRows.length > 0 && (
              <div className="expenditurereport-table-section">
                <div className="expenditurereport-section-actions">
                  <button
                    type="button"
                    className="expenditurereport-toggle-btn"
                    onClick={toggleAllSections}
                  >
                    {isAllExpanded ? (
                      <>
                        <ChevronUp size={18} /> Collapse All
                      </>
                    ) : (
                      <>
                        <ChevronDown size={18} /> Expand All
                      </>
                    )}
                  </button>
                </div>

                {(() => {
                  let serialNumber = 0;
                  return beneficiarySections.map(({ type, rows }) => {
                    const isExpanded = expandedByType[type] ?? isAllExpanded;
                    const sectionTotals = sumMetrics(rows);

                    return (
                      <div key={type} className="expenditurereport-type-section">
                        <div className="expenditurereport-type-header">
                          <h3>
                            {type} ({rows.length})
                          </h3>
                          <button
                            type="button"
                            className="expenditurereport-section-toggle-btn"
                            onClick={() => toggleSection(type)}
                          >
                            {isExpanded ? (
                              <>
                                <ChevronUp size={16} /> Collapse
                              </>
                            ) : (
                              <>
                                <ChevronDown size={16} /> Expand
                              </>
                            )}
                          </button>
                        </div>
                        <div className="expenditurereport-table-wrapper">
                          <table className="expenditurereport-table">
                            {isExpanded && (
                              <thead>
                                <tr>
                                  <th>S.No</th>
                                  <th>Beneficiary</th>
                                  {renderAmountHeaders()}
                                </tr>
                              </thead>
                            )}
                            {isExpanded && (
                              <tbody>
                                {rows.map((row) => {
                                  serialNumber += 1;
                                  return (
                                    <tr key={row.beneficiaryKey}>
                                      <td>{serialNumber}</td>
                                      <td>{row.beneficiaryLabel}</td>
                                      {renderAmountCells(row)}
                                    </tr>
                                  );
                                })}
                              </tbody>
                            )}
                            <tfoot>
                              <tr className="expenditurereport-total-row">
                                <td />
                                <td>
                                  <strong>{type} Total</strong>
                                </td>
                                {renderAmountCells(sectionTotals, true)}
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    );
                  });
                })()}

                <div className="expenditurereport-table-wrapper">
                  <table className="expenditurereport-table expenditurereport-grand-table">
                    <tbody>
                      <tr className="expenditurereport-total-row">
                        <td />
                        <td>
                          <strong>GRAND TOTAL</strong>
                        </td>
                        {renderAmountCells(beneficiaryTotals, true)}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'beneficiary' && showEmptyState && beneficiaryRows.length === 0 && (
              <div className="expenditurereport-state">
                No beneficiary spend recorded for the selected period.
              </div>
            )}

            {/* ── Tab 3: month-wise ──────────────────────────────────────── */}
            {activeTab === 'monthly' && showEmptyState && monthlyRows.length > 0 && (
              <>
                {monthColumnsTruncated && (
                  <div className="expenditurereport-notice">
                    That range covers too many months to show as columns, so only months with spend
                    are listed. Narrow the range for a full month-by-month view.
                  </div>
                )}
                <div className="expenditurereport-table-wrapper">
                  <table className="expenditurereport-table expenditurereport-month-table">
                    <thead>
                      <tr>
                        <th>Budget Head</th>
                        {monthColumns.map((column) => (
                          <th key={column.key}>{column.label}</th>
                        ))}
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyRows.map((row) => (
                        <tr key={row.budgetHead}>
                          <td className="expenditurereport-month-head">{row.budgetHead}</td>
                          {monthColumns.map((column) => (
                            <td key={column.key}>
                              {formatAmount(
                                Number(row.byMonth?.[column.key]?.[monthMetricKey] || 0),
                              )}
                            </td>
                          ))}
                          <td>
                            <strong>{formatAmount(monthlyRowTotal(row))}</strong>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="expenditurereport-total-row">
                        <td>
                          <strong>Total</strong>
                        </td>
                        {monthColumns.map((column) => (
                          <td key={column.key}>
                            <strong>{formatAmount(monthlyTotalsByMonth[column.key] || 0)}</strong>
                          </td>
                        ))}
                        <td>
                          <strong>{formatAmount(monthlyGrandTotal)}</strong>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            )}

            {activeTab === 'monthly' && showEmptyState && monthlyRows.length === 0 && (
              <div className="expenditurereport-state">
                No expenditure recorded for the selected period.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExpenditureReport;
