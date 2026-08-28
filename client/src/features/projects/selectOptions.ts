import type { SelectOption } from './components/FormFields';

/**
 * Keeps a stored selection visible in a dropdown even when it is no longer
 * offered — an administrator can deactivate a funding agency or scheme that
 * existing projects still point at, and without this the select would render
 * empty and a save would silently drop the value.
 */
export function withSelectedOption(
  options: SelectOption[],
  value: string,
  label?: string | null,
): SelectOption[] {
  if (!value || options.some((option) => option.value === value)) return options;

  return [{ value, label: label?.trim() || 'Currently selected (no longer listed)' }, ...options];
}
