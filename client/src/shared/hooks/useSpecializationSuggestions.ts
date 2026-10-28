import { useMemo, useRef, useState } from 'react';

import authenticityUtility from '../utils/authenticityUtility';

import type { OptionType } from '../components/ui/CustomDropdown';

/** A row of GET /directory-options. */
export interface DirectoryListRow {
  list_key: 'tag' | 'specialization';
  name: string;
  approval_status?: 'Approved' | 'Pending' | 'Rejected';
}

// The value of the "Add …" entry; never a real specialization.
const SUGGEST_PREFIX = '__suggest_specialization__:';

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

interface Options {
  /** The list rows the form loaded: approved entries and the user's own Pending ones. */
  rows: DirectoryListRow[];
  selected: string[];
  onSelectedChange: (names: string[]) => void;
}

/**
 * The Specialization dropdown of the organization and person forms, with a way to add one
 * that is not listed. Typing a name the list lacks offers "Add "…" as a new specialization";
 * picking it sends the name to the Directory Admin for review (POST
 * /directory-options/suggestions) and selects it. Until the admin approves it only this user
 * is offered it, it reads "(Pending)", and the record it is saved on waits for it.
 *
 * Returns the props for CustomDropdown, plus a note to show under the field.
 */
export function useSpecializationSuggestions({ rows, selected, onSelectedChange }: Options) {
  const [inputValue, setInputValue] = useState('');
  const [added, setAdded] = useState<DirectoryListRow[]>([]);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  // The selection as of the latest render: a suggestion selects itself once the server
  // answers, by which time the user may have picked or removed other entries.
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  const entries = useMemo(() => {
    const byName = new Map<string, DirectoryListRow>();
    for (const row of [...rows, ...added])
      if (row.list_key === 'specialization') byName.set(row.name.toLowerCase(), row);
    return [...byName.values()];
  }, [rows, added]);

  const isPending = (name: string) =>
    entries.some((row) => sameName(row.name, name) && row.approval_status === 'Pending');
  const labelOf = (name: string) => (isPending(name) ? `${name} (Pending)` : name);

  const typed = inputValue.trim();
  const isListed =
    !typed ||
    entries.some((row) => sameName(row.name, typed)) ||
    selected.some((name) => sameName(name, typed));

  const options: OptionType[] = [
    ...entries.map((row) => ({ value: row.name, label: labelOf(row.name) })),
    // A stored value the list no longer offers is still shown, so an edit never drops it.
    ...selected
      .filter((name) => !entries.some((row) => sameName(row.name, name)))
      .map((name) => ({ value: name, label: name })),
    ...(isListed
      ? []
      : [{ value: `${SUGGEST_PREFIX}${typed}`, label: `Add "${typed}" as a new specialization` }]),
  ];

  const suggest = async (name: string) => {
    setAdding(true);
    setError('');
    try {
      const response = (await authenticityUtility.post('/directory-options/suggestions', {
        name,
      })) as { data?: DirectoryListRow };
      const entry = response.data;
      if (!entry) throw new Error('The specialization was not added.');
      setAdded((current) => [...current, { ...entry, list_key: 'specialization' }]);
      const current = selectedRef.current;
      if (!current.some((value) => sameName(value, entry.name)))
        onSelectedChange([...current, entry.name]);
    } catch (err: any) {
      setError(
        err?.response?.data?.message || err?.message || 'The specialization could not be added.',
      );
    } finally {
      setAdding(false);
    }
  };

  const onChange = (picked: any) => {
    const values: string[] = (picked || []).map((option: OptionType) => String(option.value));
    const kept = values.filter((value) => !value.startsWith(SUGGEST_PREFIX));
    const suggestion = values.find((value) => value.startsWith(SUGGEST_PREFIX));
    setError('');
    onSelectedChange(kept);
    if (suggestion) void suggest(suggestion.slice(SUGGEST_PREFIX.length));
  };

  return {
    dropdownProps: {
      options,
      value: selected.map((name) => ({ value: name, label: labelOf(name) })),
      onChange,
      onInputChange: setInputValue,
      isLoading: adding,
      noOptionsMessage: () => 'Type a specialization to add it',
    },
    error,
    note: selected.some(isPending)
      ? 'A pending specialization waits for the Directory Admin; this record is approved after it.'
      : '',
  };
}
