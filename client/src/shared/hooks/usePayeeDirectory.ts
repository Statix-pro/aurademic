import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import authenticityUtility from '../utils/authenticityUtility';

export interface PayeeDirectoryRecord {
  id: number;
  payee_name?: string;
  account_name?: string | null;
  pan_number?: string | null;
  account_no?: string;
  account_type?: string | null;
  ifsc?: string;
  bank_name?: string;
  branch_name?: string;
  beneficiary_type?: string | null;
  beneficiary_org?: string | null;
  /** Student / Faculty / Staff — set only for a KSRCT or KSREI individual. */
  beneficiary_category?: string | null;
  organization_type?: string | null;
  msme?: string | null;
  gstin?: string | null;
  tds_details?: string | null;
  tds_section?: string | null;
  approval_status?: string | null;
  rejection_reason?: string | null;
  requested_at?: string | null;
  approved_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export type PayeeDirectoryStatus = 'all' | 'pending' | 'approved' | 'rejected';
export type PayeeDirectoryBeneficiaryType = 'all' | 'individual' | 'organization';

export interface PayeeDirectoryCounts {
  all: number;
  pending: number;
  approved: number;
  rejected: number;
}

export interface PayeeDirectory {
  rows: PayeeDirectoryRecord[];
  /** Status tallies for the current search/beneficiary filters — what the tiles show. */
  counts: PayeeDirectoryCounts;
  /** Payees awaiting approval across the whole master, ignoring every filter. */
  pendingTotal: number;
  total: number;
  loading: boolean;
  /** False until a request has settled, so the screen can tell "empty" from "not read yet". */
  hasLoaded: boolean;
  error: string;
  search: string;
  setSearch: (value: string) => void;
  status: PayeeDirectoryStatus;
  setStatus: (value: PayeeDirectoryStatus) => void;
  beneficiaryType: PayeeDirectoryBeneficiaryType;
  setBeneficiaryType: (value: PayeeDirectoryBeneficiaryType) => void;
  page: number;
  setPage: (value: number) => void;
  pageSize: number;
  totalPages: number;
  isFiltered: boolean;
  refresh: () => void;
}

interface UsePayeeDirectoryOptions {
  apiBasePath: string;
  enabled?: boolean;
  pageSize?: number;
}

const EMPTY_COUNTS: PayeeDirectoryCounts = { all: 0, pending: 0, approved: 0, rejected: 0 };
const DEFAULT_PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

/**
 * Server-paged reader for the payee master.
 *
 * Every filter, the page window and all four status counts are resolved by
 * `GET {apiBasePath}/payees/directory`, so the screen holds one page at a time
 * and stays correct no matter how large the payee master grows.
 */
export function usePayeeDirectory({
  apiBasePath,
  enabled = true,
  pageSize = DEFAULT_PAGE_SIZE,
}: UsePayeeDirectoryOptions): PayeeDirectory {
  const [search, setSearchValue] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [status, setStatusValue] = useState<PayeeDirectoryStatus>('all');
  const [beneficiaryType, setBeneficiaryTypeValue] = useState<PayeeDirectoryBeneficiaryType>('all');
  const [page, setPageValue] = useState(1);
  const [rows, setRows] = useState<PayeeDirectoryRecord[]>([]);
  const [counts, setCounts] = useState<PayeeDirectoryCounts>(EMPTY_COUNTS);
  const [total, setTotal] = useState(0);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);
  const latestRequestRef = useRef(0);

  // Typing only moves `search`; the request runs on the settled value so each
  // keystroke does not become a query.
  useEffect(() => {
    const trimmed = search.trim();
    if (trimmed === appliedSearch) return undefined;
    const timer = window.setTimeout(() => {
      setAppliedSearch(trimmed);
      setPageValue(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [search, appliedSearch]);

  useEffect(() => {
    if (!enabled) {
      // Invalidate any request still in flight, or its late response would
      // repopulate the rows this branch just cleared.
      latestRequestRef.current += 1;
      setRows([]);
      setCounts(EMPTY_COUNTS);
      setTotal(0);
      setPendingTotal(0);
      setError('');
      setLoading(false);
      setHasLoaded(false);
      return;
    }

    const requestId = latestRequestRef.current + 1;
    latestRequestRef.current = requestId;
    setLoading(true);

    void (async () => {
      try {
        const response = (await authenticityUtility.get(`${apiBasePath}/payees/directory`, {
          params: {
            search: appliedSearch,
            status,
            beneficiary_type: beneficiaryType,
            limit: pageSize,
            offset: (page - 1) * pageSize,
          },
        })) as {
          success?: boolean;
          status?: string;
          data?: PayeeDirectoryRecord[];
          meta?: {
            total?: number;
            counts?: Partial<PayeeDirectoryCounts>;
            pending_total?: number;
          };
        };

        // A slower earlier request must never overwrite a newer page.
        if (latestRequestRef.current !== requestId) return;

        if (response?.success === true || response?.status === 'success') {
          const nextCounts = { ...EMPTY_COUNTS, ...(response.meta?.counts || {}) };
          setRows(Array.isArray(response.data) ? response.data : []);
          setCounts(nextCounts);
          setTotal(Number(response.meta?.total || 0));
          setPendingTotal(
            response.meta?.pending_total === undefined
              ? nextCounts.pending
              : Number(response.meta.pending_total || 0),
          );
          setError('');
        } else {
          setRows([]);
          setCounts(EMPTY_COUNTS);
          setTotal(0);
          setPendingTotal(0);
          setError('Unable to load payees.');
        }
      } catch (fetchError: any) {
        if (latestRequestRef.current !== requestId) return;
        setRows([]);
        setCounts(EMPTY_COUNTS);
        setTotal(0);
        setPendingTotal(0);
        setError(
          fetchError?.response?.data?.message || fetchError?.message || 'Unable to load payees.',
        );
      } finally {
        if (latestRequestRef.current === requestId) {
          setLoading(false);
          setHasLoaded(true);
        }
      }
    })();
  }, [apiBasePath, enabled, appliedSearch, status, beneficiaryType, page, pageSize, reloadToken]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPageValue(totalPages);
  }, [page, totalPages]);

  const setSearch = useCallback((value: string) => setSearchValue(value), []);

  const setStatus = useCallback((value: PayeeDirectoryStatus) => {
    setStatusValue(value);
    setPageValue(1);
  }, []);

  const setBeneficiaryType = useCallback((value: PayeeDirectoryBeneficiaryType) => {
    setBeneficiaryTypeValue(value);
    setPageValue(1);
  }, []);

  const setPage = useCallback((value: number) => {
    setPageValue(Math.max(1, Math.floor(value) || 1));
  }, []);

  const refresh = useCallback(() => setReloadToken((token) => token + 1), []);

  return {
    rows,
    counts,
    pendingTotal,
    total,
    loading,
    hasLoaded,
    error,
    search,
    setSearch,
    status,
    setStatus,
    beneficiaryType,
    setBeneficiaryType,
    page,
    setPage,
    pageSize,
    totalPages,
    isFiltered: Boolean(appliedSearch) || status !== 'all' || beneficiaryType !== 'all',
    refresh,
  };
}

export default usePayeeDirectory;
