/**
 * Module-scope live store for the budget catalog.
 *
 * The three large feature files (budget, finance approval, expenditure approval)
 * previously read hardcoded constants at module scope. To keep their call sites
 * intact while moving the source to the DB, this store exposes the same shapes
 * as live values that are populated by `hydrateBudgetCatalogStore` on first
 * successful fetch. Components must mount `useBudgetCatalog()` (or its bootstrap
 * variant `useEnsureBudgetCatalog`) to trigger the fetch — accessing the store
 * before hydration returns empty values.
 */

import type { BudgetCatalog } from './useBudgetCatalog';

export interface BudgetHeadGroup {
    label: string;
    options: string[];
}

export interface EventSubHeadGroup {
    label: string;
    options: { value: string; label: string }[];
}

export const BUDGET_HEAD_GROUPS: BudgetHeadGroup[] = [];
export const SUB_HEAD_BY_BUDGET_HEAD: Record<string, string[]> = {};
export const HOAC_SUBHEAD_OPTIONS: Record<string, string[]> = {};
export const EVENT_SUBHEAD_GROUPS: Record<string, EventSubHeadGroup[]> = {};
export const HEAD_TO_GROUP: Record<string, string> = {};
export const HOAC_GROUPS = new Set(['Events & Competitions', 'Meetings & Audits']);

// NEW: separate "all heads" index (including inactive). Used by finance /
// expenditure approval forms when displaying an existing approved budget
// whose head was later deactivated — so the head name still resolves to a
// canonical entry instead of looking like an unknown value.
// LEGACY: the four exports above (`BUDGET_HEAD_GROUPS`, …) keep their
// active-only contract so new submission forms never show inactive heads.
export const ALL_HEADS_BY_NAME: Record<string, { id: number; isActive: boolean; groupLabel: string }> = {};
export const ALL_SUB_HEADS_BY_NAME: Record<string, { id: number; isActive: boolean; headName: string | null; scope: string }> = {};

/**
 * Is the named head currently active in the catalog? Returns `true` for
 * unknown names so legacy snapshot text doesn't get incorrectly flagged as
 * inactive.
 */
export function isHeadActive(name: string | null | undefined): boolean {
    if (!name) return true;
    const entry = ALL_HEADS_BY_NAME[name];
    return entry ? entry.isActive : true;
}

/**
 * For display: append "(inactive)" to a head/sub-head label when it's no
 * longer in the active catalog. Snapshot text on already-approved records
 * stays selectable in finance / expenditure flows — the suffix is purely
 * informational.
 */
export function decorateInactive(name: string | null | undefined): string {
    if (!name) return '';
    return isHeadActive(name) ? name : `${name} (inactive)`;
}

const listeners = new Set<() => void>();

export function subscribeBudgetCatalog(cb: () => void): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
}

function clear<T extends Record<string, unknown>>(obj: T) {
    for (const key of Object.keys(obj)) {
        delete (obj as any)[key];
    }
}

export function hydrateBudgetCatalogStore(catalog: BudgetCatalog) {
    BUDGET_HEAD_GROUPS.length = 0;
    clear(SUB_HEAD_BY_BUDGET_HEAD);
    clear(HOAC_SUBHEAD_OPTIONS);
    clear(EVENT_SUBHEAD_GROUPS);
    clear(HEAD_TO_GROUP);
    clear(ALL_HEADS_BY_NAME);
    clear(ALL_SUB_HEADS_BY_NAME);

    // Index ALL heads/sub-heads (active + inactive) for display helpers.
    catalog.heads.forEach((h) => {
        ALL_HEADS_BY_NAME[h.name] = {
            id: h.id,
            isActive: !!h.is_active,
            groupLabel: h.group_label,
        };
    });
    catalog.subHeads.forEach((s) => {
        ALL_SUB_HEADS_BY_NAME[s.name] = {
            id: s.id,
            isActive: !!s.is_active,
            headName: s.head_name,
            scope: s.scope,
        };
    });

    // Heads grouped by group_label, preserving sort order
    const byGroup = new Map<string, { sortOrder: number; heads: typeof catalog.heads }>();
    catalog.heads.forEach((h) => {
        if (!h.is_active) return;
        if (!byGroup.has(h.group_label)) {
            byGroup.set(h.group_label, { sortOrder: h.sort_order, heads: [] });
        }
        byGroup.get(h.group_label)!.heads.push(h);
        HEAD_TO_GROUP[h.name] = h.group_label;
    });
    Array.from(byGroup.entries())
        .sort((a, b) => a[1].sortOrder - b[1].sortOrder)
        .forEach(([label, { heads }]) => {
            BUDGET_HEAD_GROUPS.push({
                label,
                options: heads
                    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
                    .map((h) => h.name),
            });
        });

    // Sub-heads by scope
    catalog.subHeads.forEach((s) => {
        if (!s.is_active) return;
        if (s.scope === 'head-specific' && s.head_name) {
            if (!SUB_HEAD_BY_BUDGET_HEAD[s.head_name]) {
                SUB_HEAD_BY_BUDGET_HEAD[s.head_name] = [];
            }
            SUB_HEAD_BY_BUDGET_HEAD[s.head_name].push(s.name);
        } else if (s.scope === 'hoac-shared' && s.event_type) {
            if (!HOAC_SUBHEAD_OPTIONS[s.event_type]) {
                HOAC_SUBHEAD_OPTIONS[s.event_type] = [];
            }
            HOAC_SUBHEAD_OPTIONS[s.event_type].push(s.name);
        } else if (s.scope === 'event-specific' && s.event_type) {
            if (!EVENT_SUBHEAD_GROUPS[s.event_type]) {
                EVENT_SUBHEAD_GROUPS[s.event_type] = [];
            }
            const groupLabel = s.group_label || '';
            let group = EVENT_SUBHEAD_GROUPS[s.event_type].find((g) => g.label === groupLabel);
            if (!group) {
                group = { label: groupLabel, options: [] };
                EVENT_SUBHEAD_GROUPS[s.event_type].push(group);
            }
            group.options.push({ value: s.name, label: s.name });
        }
    });

    listeners.forEach((cb) => {
        try {
            cb();
        } catch {
            // ignore listener errors
        }
    });
}
