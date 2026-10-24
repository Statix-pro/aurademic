import React, { useEffect, useRef, useState } from 'react';

import CustomButton from '../../shared/components/ui/CustomButton';
import CustomDropdown, { OptionType } from '../../shared/components/ui/CustomDropdown';
import CustomInput from '../../shared/components/ui/CustomInput';
import CustomModal from '../../shared/components/ui/CustomModal';
import authenticityUtility from '../../shared/utils/authenticityUtility';

export interface Publisher {
  id: number;
  name: string;
  status: 'approved' | 'pending' | 'rejected';
}

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  message?: string;
}

const toOption = (publisher: { id: number | null; name: string; status?: string }): OptionType => ({
  value: publisher.id ?? publisher.name,
  // A pending entry is the requester's own add; flag it so they know it is unreviewed.
  label: publisher.status === 'pending' ? `${publisher.name} (pending review)` : publisher.name,
  publisherId: publisher.id,
  publisherName: publisher.name,
});

interface PublisherSelectProps {
  /** The linked master row, when the record has one. */
  publisherId: number | null;
  /** The stored name — also what a record filed before the master existed shows. */
  publisherName: string;
  onChange: (publisher: { id: number | null; name: string }) => void;
  disabled?: boolean;
}

/**
 * Searches the publisher master as the user types. A record filed before the master
 * existed has a name but no id; it is shown as-is until the user picks a master entry.
 */
export const PublisherSelect: React.FC<PublisherSelectProps> = ({
  publisherId,
  publisherName,
  onChange,
  disabled = false,
}) => {
  const [options, setOptions] = useState<OptionType[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const requestSeq = useRef(0);

  useEffect(() => {
    if (disabled) return undefined;
    const seq = ++requestSeq.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = (await authenticityUtility.get(
          `/publishers?query=${encodeURIComponent(query)}`,
        )) as ApiEnvelope<Publisher[]>;
        // Only the latest keystroke's answer may land; an older, slower one would
        // otherwise overwrite it.
        if (seq === requestSeq.current) {
          setOptions((response.data ?? []).map(toOption));
        }
      } catch (error) {
        console.error('Error searching publishers:', error);
        if (seq === requestSeq.current) setOptions([]);
      } finally {
        if (seq === requestSeq.current) setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, disabled]);

  const selected = publisherName ? toOption({ id: publisherId, name: publisherName }) : null;

  return (
    <CustomDropdown
      name="publisherSelect"
      className="publisher-select"
      options={options}
      value={selected}
      onChange={(value) => {
        const option = value as OptionType | null;
        onChange(
          option
            ? { id: option.publisherId as number, name: option.publisherName as string }
            : { id: null, name: '' },
        );
      }}
      onInputChange={setQuery}
      // The server already filtered by the typed text; matching again on the label
      // would hide nothing useful and drop a pending entry's "(pending review)" suffix.
      filterOption={() => true}
      isLoading={loading}
      isClearable
      isDisabled={disabled}
      placeholder="Select Publisher"
      noOptionsMessage={({ inputValue }) =>
        inputValue ? 'No publisher matches — use Add Publisher' : 'No publishers yet'
      }
    />
  );
};

interface AddPublisherModalProps {
  show: boolean;
  onHide: () => void;
  /** Receives the row the server settled on — new, or the existing one with that name. */
  onAdded: (publisher: Publisher, message: string) => void;
}

export const AddPublisherModal: React.FC<AddPublisherModalProps> = ({ show, onHide, onAdded }) => {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (show) {
      setName('');
      setError('');
    }
  }, [show]);

  const submit = async () => {
    if (!name.trim()) {
      setError('Publisher name is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const response = (await authenticityUtility.post('/publishers', {
        name,
      })) as ApiEnvelope<Publisher>;
      if (response.data) {
        onAdded(response.data, response.message ?? '');
      }
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { message?: string } } };
      setError(
        apiError.response?.data?.message || 'Could not add the publisher. Please try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <CustomModal
      show={show}
      onHide={onHide}
      title="Add Publisher"
      size="sm"
      footer={
        <>
          <CustomButton variant="secondary" onClick={onHide} disabled={saving}>
            Cancel
          </CustomButton>
          <CustomButton onClick={submit} loading={saving} disabled={saving}>
            Add
          </CustomButton>
        </>
      }
    >
      <CustomInput
        name="newPublisherName"
        label="Publisher Name"
        value={name}
        onChange={setName}
        placeholder="e.g., Springer Nature"
        error={error}
        autoFocus
        required
      />
      <p className="text-muted small mb-0 mt-2">
        You can use it right away. An administrator will review it before it is offered to others.
      </p>
    </CustomModal>
  );
};
