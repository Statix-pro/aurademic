import React, { useEffect, useState } from 'react';

import CustomDropdown from './ui/CustomDropdown';
import CustomInput from './ui/CustomInput';
import { DEFAULT_COUNTRY, INDIAN_STATES, isIndia, toListedState } from '../utils/regions';

const OTHER = '__other__';
const COUNTRY_OPTIONS = [
  { value: DEFAULT_COUNTRY, label: DEFAULT_COUNTRY },
  { value: OTHER, label: 'Other…' },
];
const STATE_OPTIONS = [
  ...INDIAN_STATES.map((state) => ({ value: state, label: state })),
  { value: OTHER, label: 'Other…' },
];

interface RegionFieldsProps {
  /** Prefix for the inputs' names and ids, unique on the page (e.g. `rp-0`). */
  idPrefix: string;
  country: string;
  state: string;
  onChange: (next: { country: string; state: string }) => void;
  disabled?: boolean;
  /** The host form's field wrapper, so its label and input styles apply. */
  fieldClassName: string;
  fieldStyle?: React.CSSProperties;
  /** The host form's dropdown styles, so the dropdowns match its other controls. */
  dropdownStyles: any;
  /**
   * The host form's required marker. Given, Country is required, and State too while it is
   * India's list (another country's province is optional).
   */
  requiredMark?: React.ReactNode;
  /** Save-time errors, shown under their field. */
  errors?: { state?: string; country?: string };
}

/**
 * State and Country for an address. Country offers India or Other; State lists India's
 * states and union territories when the country is India. Either "Other…" turns that cell
 * into a text box for a value of the user's own, in the same cell so the row never grows,
 * with a × inside it to go back. Both are stored as the plain text shown.
 */
const RegionFields: React.FC<RegionFieldsProps> = ({
  idPrefix,
  country,
  state,
  onChange,
  disabled = false,
  fieldClassName,
  fieldStyle,
  dropdownStyles,
  requiredMark,
  errors = {},
}) => {
  const [countryTyped, setCountryTyped] = useState(() => !isIndia(country));
  const [stateTyped, setStateTyped] = useState(
    () => Boolean(state.trim()) && !toListedState(state),
  );

  // A value set from outside (a loaded record, an organization's address copied in)
  // decides the mode; an empty one leaves it, so "Other…" stays open while it is typed.
  useEffect(() => {
    if (country.trim()) setCountryTyped(!isIndia(country));
  }, [country]);
  useEffect(() => {
    if (state.trim()) setStateTyped(!toListedState(state));
  }, [state]);

  const stateIsFree = countryTyped;
  const countryName = `${idPrefix}-country`;
  const stateName = `${idPrefix}-state`;
  const mark = (required: boolean) => (required && requiredMark ? <> {requiredMark}</> : null);

  return (
    <>
      <div className={fieldClassName} style={fieldStyle}>
        {stateIsFree || stateTyped ? (
          <>
            <label htmlFor={stateName}>State{mark(!stateIsFree)}</label>
            <CustomInput
              name={stateName}
              error={errors.state}
              value={state}
              onChange={(value) => onChange({ country, state: value })}
              placeholder={stateIsFree ? 'State / Province' : 'Type the state'}
              disabled={disabled}
              className="mb-0"
              onClear={
                stateIsFree
                  ? undefined
                  : () => {
                      setStateTyped(false);
                      onChange({ country, state: '' });
                    }
              }
              clearLabel="Back to the state list"
            />
          </>
        ) : (
          <>
            <label htmlFor={stateName}>State{mark(true)}</label>
            <CustomDropdown
              name={stateName}
              error={errors.state}
              className="mb-0"
              value={state ? { value: toListedState(state) ?? state, label: state } : null}
              onChange={(option: any) => {
                if (option?.value === OTHER) {
                  setStateTyped(true);
                  onChange({ country, state: '' });
                  return;
                }
                onChange({ country, state: option ? String(option.value) : '' });
              }}
              options={STATE_OPTIONS}
              placeholder="Select state"
              styles={dropdownStyles}
              isDisabled={disabled}
            />
          </>
        )}
      </div>
      <div className={fieldClassName} style={fieldStyle}>
        {countryTyped ? (
          <>
            <label htmlFor={countryName}>Country{mark(true)}</label>
            <CustomInput
              name={countryName}
              error={errors.country}
              value={country}
              onChange={(value) => onChange({ country: value, state })}
              placeholder="Type the country"
              disabled={disabled}
              className="mb-0"
              onClear={() => {
                setCountryTyped(false);
                onChange({ country: DEFAULT_COUNTRY, state: '' });
              }}
              clearLabel="Back to the country list"
            />
          </>
        ) : (
          <>
            <label htmlFor={countryName}>Country{mark(true)}</label>
            <CustomDropdown
              name={countryName}
              error={errors.country}
              className="mb-0"
              value={COUNTRY_OPTIONS[0]}
              onChange={(option: any) => {
                if (option?.value === OTHER) {
                  setCountryTyped(true);
                  // An Indian state means nothing once the country is another one.
                  onChange({ country: '', state: toListedState(state) ? '' : state });
                }
              }}
              options={COUNTRY_OPTIONS}
              styles={dropdownStyles}
              isDisabled={disabled}
            />
          </>
        )}
      </div>
    </>
  );
};

export default RegionFields;
