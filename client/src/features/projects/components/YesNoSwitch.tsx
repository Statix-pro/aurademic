import React from 'react';

interface YesNoSwitchProps {
  name: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  label?: string;
}

/** The two-segment Yes/No pill used for "Active MoU" and the CFRD copy question. */
const YesNoSwitch: React.FC<YesNoSwitchProps> = ({
  name,
  value,
  onChange,
  disabled = false,
  label,
}) => (
  <div className="pf-yesno" role="group" aria-label={label ?? name}>
    {[
      { text: 'Yes', selected: value === true },
      { text: 'No', selected: value === false },
    ].map((option) => (
      <button
        key={option.text}
        type="button"
        className={`pf-yesno__option ${option.selected ? 'is-selected' : ''}`.trim()}
        onClick={() => onChange(option.text === 'Yes')}
        disabled={disabled}
        aria-pressed={option.selected}
      >
        {option.text}
      </button>
    ))}
  </div>
);

export default YesNoSwitch;
