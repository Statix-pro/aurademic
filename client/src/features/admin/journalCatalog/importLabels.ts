import type { BatchStatus, Outcome, Resolution } from './types';

/** `admin-badge` variants from the admin screen shell, plus the screen's own warning tint. */
export const OUTCOME_BADGE: Record<Outcome, { label: string; className: string }> = {
  add: { label: 'Add', className: 'admin-badge--yes' },
  update: { label: 'Update', className: 'admin-badge--info' },
  unchanged: { label: 'No change', className: 'admin-badge--muted' },
  exception: { label: 'Needs review', className: 'journal-import__badge--warn' },
};

export const RESOLUTION_BADGE: Record<Resolution, { label: string; className: string }> = {
  pending: { label: 'Open', className: 'journal-import__badge--warn' },
  applied: { label: 'Applied', className: 'admin-badge--yes' },
  excluded: { label: 'Excluded', className: 'admin-badge--muted' },
};

export const STATUS_BADGE: Record<BatchStatus, { label: string; className: string }> = {
  previewed: { label: 'Preview — not applied', className: 'admin-badge--info' },
  applied: { label: 'Applied', className: 'admin-badge--yes' },
  discarded: { label: 'Discarded', className: 'admin-badge--muted' },
};

export const errorMessage = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { message?: string } }; message?: string })?.response?.data
    ?.message ||
  (error as { message?: string })?.message ||
  fallback;

export const formatDateTime = (value: string | null) =>
  value
    ? new Date(value).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';
