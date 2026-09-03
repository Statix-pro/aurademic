/**
 * Category presentation, shared by the inbox rail and the preferences screen.
 *
 * The server sends a category slug and nothing else, so the label, icon and
 * display order live here — in one place, because two screens group by
 * category and they must not drift into different names or orders.
 */

import {
  BookOpen,
  CalendarDays,
  FolderKanban,
  PencilLine,
  PieChart,
  Receipt,
  ShieldCheck,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

export interface CategoryMeta {
  label: string;
  icon: LucideIcon;
}

export const CATEGORY_META: Record<string, CategoryMeta> = {
  finance: { label: 'Finance', icon: Wallet },
  expenditure: { label: 'Expenditure', icon: Receipt },
  budget: { label: 'Budget', icon: PieChart },
  publications: { label: 'Publications', icon: BookOpen },
  projects: { label: 'Projects', icon: FolderKanban },
  edit_requests: { label: 'Edit requests', icon: PencilLine },
  events: { label: 'Events', icon: CalendarDays },
  access: { label: 'Access & roles', icon: ShieldCheck },
};

/**
 * Explicit order rather than alphabetical: this is roughly the order money
 * moves through the portal, which is how the people using it think about it.
 */
export const CATEGORY_ORDER = [
  'finance',
  'expenditure',
  'budget',
  'publications',
  'projects',
  'edit_requests',
  'events',
  'access',
];

/** Falls back gracefully so a category added server-side still renders. */
export const categoryLabel = (category: string): string =>
  CATEGORY_META[category]?.label ?? category.replace(/_/g, ' ');

export const categoryIcon = (category: string): LucideIcon | null =>
  CATEGORY_META[category]?.icon ?? null;

/** Unknown categories sort last, keeping their relative order. */
export const byCategoryOrder = (a: string, b: string): number => {
  const ai = CATEGORY_ORDER.indexOf(a);
  const bi = CATEGORY_ORDER.indexOf(b);
  return (ai === -1 ? CATEGORY_ORDER.length : ai) - (bi === -1 ? CATEGORY_ORDER.length : bi);
};
