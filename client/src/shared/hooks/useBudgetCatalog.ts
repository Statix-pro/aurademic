import { useCallback, useEffect, useMemo, useState } from 'react';

import { hydrateBudgetCatalogStore } from './budgetCatalogStore';
import authenticityUtility from '../utils/authenticityUtility';

export interface BudgetHead {
  id: number;
  name: string;
  code: string | null;
  group_label: string;
  sort_order: number;
  is_active: number;
}

export interface BudgetSubHead {
  id: number;
  name: string;
  code: string | null;
  head_id: number | null;
  head_name: string | null;
  scope: 'head-specific' | 'hoac-shared';
  event_type: string | null;
  group_label: string | null;
  sort_order: number;
  is_active: number;
}

export interface BudgetHeadGroup {
  label: string;
  options: string[];
}

export interface BudgetCatalog {
  heads: BudgetHead[];
  subHeads: BudgetSubHead[];
}

interface CatalogState {
  catalog: BudgetCatalog | null;
  loading: boolean;
  error: string | null;
}

let cachedCatalog: BudgetCatalog | null = null;
let pendingFetch: Promise<BudgetCatalog> | null = null;
const subscribers = new Set<(c: BudgetCatalog) => void>();

async function fetchCatalog(force = false): Promise<BudgetCatalog> {
  if (!force && cachedCatalog) return cachedCatalog;
  if (!force && pendingFetch) return pendingFetch;
  pendingFetch = (async () => {
    const response = await authenticityUtility.get('/budget-catalog');
    const payload = response.data?.data ?? response.data;
    const catalog: BudgetCatalog = {
      heads: Array.isArray(payload?.heads) ? payload.heads : [],
      subHeads: Array.isArray(payload?.subHeads) ? payload.subHeads : [],
    };
    cachedCatalog = catalog;
    hydrateBudgetCatalogStore(catalog);
    subscribers.forEach((cb) => {
      try {
        cb(catalog);
      } catch (err) {
        console.error('Budget catalog subscriber failed', err);
      }
    });
    return catalog;
  })().finally(() => {
    pendingFetch = null;
  });
  return pendingFetch;
}

export function refreshBudgetCatalog(): Promise<BudgetCatalog> {
  return fetchCatalog(true);
}

export function useBudgetCatalog() {
  const [state, setState] = useState<CatalogState>({
    catalog: cachedCatalog,
    loading: !cachedCatalog,
    error: null,
  });

  useEffect(() => {
    let mounted = true;
    const onUpdate = (c: BudgetCatalog) => {
      if (mounted) setState({ catalog: c, loading: false, error: null });
    };
    subscribers.add(onUpdate);
    if (!cachedCatalog) {
      fetchCatalog()
        .then((c) => mounted && setState({ catalog: c, loading: false, error: null }))
        .catch(
          (err) =>
            mounted &&
            setState({
              catalog: null,
              loading: false,
              error: err?.message || 'Failed to load budget catalog',
            }),
        );
    }
    return () => {
      mounted = false;
      subscribers.delete(onUpdate);
    };
  }, []);

  const catalog = state.catalog;

  const budgetHeadGroups: BudgetHeadGroup[] = useMemo(() => {
    if (!catalog) return [];
    const byGroup = new Map<string, { sortOrder: number; heads: BudgetHead[] }>();
    catalog.heads.forEach((h) => {
      if (!byGroup.has(h.group_label)) {
        byGroup.set(h.group_label, { sortOrder: h.sort_order, heads: [] });
      }
      byGroup.get(h.group_label)!.heads.push(h);
    });
    return Array.from(byGroup.entries())
      .sort((a, b) => a[1].sortOrder - b[1].sortOrder)
      .map(([label, { heads }]) => ({
        label,
        options: heads
          .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
          .map((h) => h.name),
      }));
  }, [catalog]);

  const subHeadsByHead = useCallback(
    (headName: string): string[] => {
      if (!catalog || !headName) return [];
      return catalog.subHeads
        .filter((s) => s.scope === 'head-specific' && s.head_name === headName)
        .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
        .map((s) => s.name);
    },
    [catalog],
  );

  const hoacSubHeads = useCallback(
    (eventType: string): string[] => {
      if (!catalog || !eventType) return [];
      return catalog.subHeads
        .filter((s) => s.scope === 'hoac-shared' && s.event_type === eventType)
        .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
        .map((s) => s.name);
    },
    [catalog],
  );

  return {
    catalog,
    loading: state.loading,
    error: state.error,
    budgetHeadGroups,
    subHeadsByHead,
    hoacSubHeads,
    refresh: refreshBudgetCatalog,
  };
}
