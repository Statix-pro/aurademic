import { Linkedin, Globe } from 'lucide-react';
import React, { useState, useEffect } from 'react';

import './OrganizationDirectory.css';
import RegionFields from '../../shared/components/RegionFields';
import CustomButton from '../../shared/components/ui/CustomButton';
import CustomDropdown from '../../shared/components/ui/CustomDropdown';
import CustomInput from '../../shared/components/ui/CustomInput';
import {
  type DirectoryListRow,
  useSpecializationSuggestions,
} from '../../shared/hooks/useSpecializationSuggestions';
import authenticityUtility from '../../shared/utils/authenticityUtility';
import { DEFAULT_COUNTRY, isIndia } from '../../shared/utils/regions';

/* ─── Types ─────────────────────────────────────────────── */

export interface Organization {
  id: number;
  name: string;
  abbreviation: string;
  establishmentYear: string;
  /** Picked from the Directory Admin's Specialization list. */
  specializations: string[];
  category: string;
  tag: string;
  website: string;
  linkedIn: string;
  address: string;
  city: string;
  state: string;
  country: string;
  pinCode: string;
  date: string;
  status: string; // 'Active' | 'Inactive'
  /** How it is funded; null where nobody has said yet. */
  funding?: 'Private' | 'Public' | null;
  approvalStatus?: 'Pending' | 'Approved' | 'Rejected';
  isOwner?: boolean;
  /** Who added the record, so a reader can ask them about it. */
  submitted_by_name?: string | null;
  submitted_by_email?: string | null;
  /** Suggested specializations that keep it from being approved (the owner's and reviewer's). */
  specializationHolds?: { name: string; status: string }[];
}

interface OrganizationDirectoryProps {
  editingOrg: Organization | null;
  onSave: (orgData: Omit<Organization, 'id' | 'date'>) => void;
  onCancel: () => void;
  readOnly?: boolean;
}

const FUNDING_OPTIONS = ['Private', 'Public'] as const;

const CATEGORY_OPTIONS = [
  'Academic',
  'Industry',
  'National Labs',
  'Incubation',
  'Start-up',
  'Government',
  'Organization',
  'Others',
];

// Tag and Specialization sit on --control-height like the inputs beside them; the colours
// and corners match this form's own inputs. CustomDropdown merges styles shallowly, so the
// control restates them.
const listDropdownStyles = {
  control: (provided: any, state: any) => ({
    ...provided,
    minHeight: 'var(--control-height)',
    height: 'var(--control-height)',
    backgroundColor: '#ffffff',
    // CustomDropdown marks a field it shows an error for aria-invalid.
    borderColor: state.selectProps['aria-invalid']
      ? 'var(--error-color)'
      : state.isFocused
        ? '#0069ab'
        : '#e0e0e0',
    borderRadius: '12px',
    boxShadow: state.isFocused ? '0 0 0 3px rgba(0, 105, 171, 0.15)' : 'none',
    '&:hover': { borderColor: '#0069ab' },
  }),
  valueContainer: (provided: any) => ({
    ...provided,
    minHeight: 'calc(var(--control-height) - 2px)',
    height: 'calc(var(--control-height) - 2px)',
    padding: '0 12px',
  }),
  indicatorsContainer: (provided: any) => ({
    ...provided,
    minHeight: 'calc(var(--control-height) - 2px)',
    height: 'calc(var(--control-height) - 2px)',
  }),
  // Text per AGENTS.md typography: 14px, primary-text colour.
  container: (provided: any) => ({ ...provided, fontSize: 'var(--font-size-body)' }),
  singleValue: (provided: any) => ({ ...provided, color: 'var(--text-body)' }),
  indicatorSeparator: () => ({ display: 'none' }),
};

// Several picks stay on one line and scroll sideways, so the field never grows taller
// than the Tag dropdown beside it.
const specializationDropdownStyles = {
  ...listDropdownStyles,
  valueContainer: (provided: any) => ({
    ...listDropdownStyles.valueContainer(provided),
    flexWrap: 'nowrap',
    overflowX: 'auto',
  }),
};

/** A stored value the list no longer offers is still shown, so an edit never drops it. */
const toOptions = (names: string[], selected: string[]) =>
  [...names, ...selected.filter((value) => value && !names.includes(value))].map((name) => ({
    value: name,
    label: name,
  }));

/* ═══════════════════════════════════════════════════════════
   Organization Form Component
   ═══════════════════════════════════════════════════════════ */

const OrganizationDirectory: React.FC<OrganizationDirectoryProps> = ({
  editingOrg,
  onSave,
  onCancel,
  readOnly = false,
}) => {
  /* form fields */
  const [category, setCategory] = useState('Academic');
  const [name, setName] = useState('');
  const [abbreviation, setAbbreviation] = useState('');
  const [establishmentYear, setEstablishmentYear] = useState('');
  const [specializations, setSpecializations] = useState<string[]>([]);
  const [listRows, setListRows] = useState<DirectoryListRow[]>([]);
  const tagNames = listRows.filter((row) => row.list_key === 'tag').map((row) => row.name);
  // A specialization the list lacks can be added from the field; it waits for the admin.
  const specializationField = useSpecializationSuggestions({
    rows: listRows,
    selected: specializations,
    onSelectedChange: setSpecializations,
  });
  const [listError, setListError] = useState<string | null>(null);
  const [tag, setTag] = useState('');
  const [website, setWebsite] = useState('');
  const [linkedIn, setLinkedIn] = useState('');

  /* Address fields */
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  const [pinCode, setPinCode] = useState('');

  const [status, setStatus] = useState('Active');
  const [funding, setFunding] = useState<Organization['funding']>(null);
  // Shown under the field they belong to, and cleared as soon as it is filled in.
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    funding?: string;
    city?: string;
    state?: string;
    country?: string;
  }>({});
  const clearError = (key: keyof typeof fieldErrors) =>
    setFieldErrors(({ [key]: _cleared, ...rest }) => rest);

  /* Initialize form values */
  useEffect(() => {
    if (editingOrg) {
      setCategory(editingOrg.category || 'Academic');
      setName(editingOrg.name || '');
      setAbbreviation(editingOrg.abbreviation || '');
      setEstablishmentYear(editingOrg.establishmentYear || '');
      setSpecializations(editingOrg.specializations || []);
      setTag(editingOrg.tag || '');
      setWebsite(editingOrg.website || '');
      setLinkedIn(editingOrg.linkedIn || '');
      setAddress(editingOrg.address || '');
      setCity(editingOrg.city || '');
      setState(editingOrg.state || '');
      setCountry(editingOrg.country || DEFAULT_COUNTRY);
      setPinCode(editingOrg.pinCode || '');
      setStatus(editingOrg.status || 'Active');
      setFunding(editingOrg.funding ?? null);
    }
  }, [editingOrg]);

  // Tag and Specialization come from the Directory Admin's lists; a read-only view shows
  // the stored values and needs no list.
  useEffect(() => {
    if (readOnly) return;
    let cancelled = false;
    authenticityUtility
      .get('/directory-options')
      .then((response: any) => {
        if (cancelled) return;
        setListRows(response?.data || []);
        setListError(null);
      })
      .catch((err: any) => {
        if (!cancelled)
          setListError(err?.message || 'Failed to load the Tag and Specialization lists.');
      });
    return () => {
      cancelled = true;
    };
  }, [readOnly]);

  const handleSubmit = () => {
    // The server applies the same rules (assertRequired in organizationDirectoryModel.js).
    const errors: typeof fieldErrors = {};
    if (!name.trim()) errors.name = 'Enter the organization name.';
    if (!funding) errors.funding = 'Choose Private or Public.';
    if (!city.trim()) errors.city = 'Enter the city.';
    // India's states are listed; another country's province is optional.
    if (country.trim() && isIndia(country) && !state.trim()) errors.state = 'Pick the state.';
    if (!country.trim()) errors.country = 'Enter the country.';
    setFieldErrors(errors);
    // Take the user to the first field that needs them, in the order the form shows them.
    const firstInvalid = [
      errors.name && 'orgd-name-input',
      errors.funding && 'orgd-funding-private',
      errors.city && 'orgd-city-input',
      errors.state && 'orgd-state',
      errors.country && 'orgd-country',
    ].find(Boolean);
    if (firstInvalid) {
      const target = document.getElementById(firstInvalid);
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target?.focus({ preventScroll: true });
      return;
    }
    onSave({
      name: name.trim(),
      abbreviation: abbreviation.trim(),
      establishmentYear: establishmentYear.trim(),
      specializations,
      category,
      tag: tag.trim() || 'General',
      website: website.trim(),
      linkedIn: linkedIn.trim(),
      address: address.trim(),
      city: city.trim(),
      state: state.trim(),
      country: country.trim(),
      pinCode: pinCode.trim(),
      status,
      funding,
    });
  };

  return (
    <div className="orgd-form-wrapper">
      <div className="orgd-card" style={readOnly ? { pointerEvents: 'none' } : undefined}>
        {/* Category Section */}
        <h5 className="orgd-section-title">Category</h5>
        <div className="orgd-category-chips" role="group" aria-label="Category Selector">
          {CATEGORY_OPTIONS.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`orgd-chip${category === cat ? ' active' : ''}`}
              onClick={() => setCategory(cat)}
              aria-pressed={category === cat}
            >
              {cat}
            </button>
          ))}
        </div>

        <hr className="orgd-section-title-line" />

        {/* Organization Details Section */}
        <h5 className="orgd-section-title">Organization Details</h5>

        <div className="orgd-split-row">
          {/* Left panel - Basic fields */}
          <div className="orgd-left-col">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
              <div className="orgd-field" style={{ flex: '1.6', minWidth: '200px' }}>
                {/* CustomInput's label is plain text, so the label sits outside to keep the
                    red required marker; CustomInput uses `name` as the input id. */}
                <label htmlFor="orgd-name-input">
                  Organization Name <span className="req">*</span>
                </label>
                <CustomInput
                  name="orgd-name-input"
                  value={name}
                  onChange={(value) => {
                    setName(value);
                    if (value.trim()) clearError('name');
                  }}
                  error={fieldErrors.name}
                  placeholder="e.g. KSRCT Research Center"
                  className="mb-0"
                />
              </div>
              <div className="orgd-field" style={{ flex: '1', minWidth: '160px' }}>
                <CustomInput
                  label="Abbreviation / Short Name"
                  name="orgd-abbrev-input"
                  value={abbreviation}
                  onChange={setAbbreviation}
                  placeholder="e.g. KSRCT-RC"
                  className="mb-0"
                />
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
              {/* Address takes what the two toggles, each as wide as its chips, leave. */}
              <div className="orgd-field" style={{ flex: '1', minWidth: '200px' }}>
                <CustomInput
                  label="Address"
                  name="orgd-address-input"
                  value={address}
                  onChange={setAddress}
                  placeholder="Address line"
                  className="mb-0"
                />
              </div>
              <fieldset
                className="orgd-field"
                style={{ flex: '0 0 auto', border: 'none', padding: 0, margin: 0 }}
              >
                <legend className="orgd-legend">Status</legend>
                <div className="orgd-toggle-group">
                  {['Active', 'Inactive'].map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`orgd-toggle-btn${status === s ? ' active' : ''}`}
                      onClick={() => setStatus(s)}
                      aria-pressed={status === s}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </fieldset>
              {/* Required, but neither is picked until someone says: older records have none. */}
              <fieldset
                className="orgd-field"
                style={{ flex: '0 0 auto', border: 'none', padding: 0, margin: 0 }}
              >
                <legend className="orgd-legend">
                  Funding <span className="req">*</span>
                </legend>
                <div
                  className={`orgd-toggle-group${fieldErrors.funding ? ' is-invalid' : ''}`}
                  aria-describedby={fieldErrors.funding ? 'orgd-funding-error' : undefined}
                >
                  {FUNDING_OPTIONS.map((option) => (
                    <button
                      key={option}
                      id={`orgd-funding-${option.toLowerCase()}`}
                      type="button"
                      className={`orgd-toggle-btn${funding === option ? ' active' : ''}`}
                      onClick={() => {
                        setFunding(option);
                        clearError('funding');
                      }}
                      aria-pressed={funding === option}
                    >
                      {option}
                    </button>
                  ))}
                </div>
                {fieldErrors.funding && (
                  <div id="orgd-funding-error" className="custom-error-text" role="alert">
                    {fieldErrors.funding}
                  </div>
                )}
              </fieldset>
            </div>
          </div>

          {/* Right panel - Website and LinkedIn grouped in light blue box */}
          <div className="orgd-right-col-box">
            <div className="orgd-field">
              <div className="orgd-input-icon-wrapper">
                <Globe size={16} color="#0069ab" aria-hidden="true" />
                <CustomInput
                  name="orgd-website-input"
                  type="url"
                  value={website}
                  onChange={setWebsite}
                  placeholder="Website"
                  aria-label="Website"
                  className="mb-0"
                />
              </div>
            </div>

            <div className="orgd-field">
              <div className="orgd-input-icon-wrapper">
                <Linkedin size={16} color="#0069ab" aria-hidden="true" />
                <CustomInput
                  name="orgd-linkedin-input"
                  type="url"
                  value={linkedIn}
                  onChange={setLinkedIn}
                  placeholder="LinkedIn Profile"
                  aria-label="LinkedIn Profile"
                  className="mb-0"
                />
              </div>
            </div>
          </div>
        </div>

        {/* City, State, Country, PIN Row */}
        <div className="orgd-row-4" style={{ marginTop: '8px', marginBottom: '16px' }}>
          <div className="orgd-field">
            <label htmlFor="orgd-city-input">
              City <span className="req">*</span>
            </label>
            <CustomInput
              name="orgd-city-input"
              value={city}
              onChange={(value) => {
                setCity(value);
                if (value.trim()) clearError('city');
              }}
              placeholder="City"
              className="mb-0"
              error={fieldErrors.city}
            />
          </div>
          <RegionFields
            idPrefix="orgd"
            country={country}
            state={state}
            onChange={(region) => {
              setCountry(region.country);
              setState(region.state);
              if (region.state.trim() || !isIndia(region.country)) clearError('state');
              if (region.country.trim()) clearError('country');
            }}
            disabled={readOnly}
            fieldClassName="orgd-field"
            dropdownStyles={listDropdownStyles}
            requiredMark={<span className="req">*</span>}
            errors={{ state: fieldErrors.state, country: fieldErrors.country }}
          />
          <div className="orgd-field">
            <CustomInput
              label="PIN"
              name="orgd-pin-input"
              value={pinCode}
              onChange={setPinCode}
              placeholder="PIN"
              className="mb-0"
            />
          </div>
        </div>

        {/* Tag and Specialization (Sector) Row */}
        <div className="orgd-list-row">
          <div className="orgd-field orgd-list-row__tag">
            <label>Tag</label>
            <CustomDropdown
              name="orgd-tag"
              className="mb-0"
              value={tag ? { value: tag, label: tag } : null}
              onChange={(option: any) => setTag(option ? String(option.value) : '')}
              options={toOptions(tagNames, [tag])}
              placeholder="Select tag"
              styles={listDropdownStyles}
              isDisabled={readOnly}
              isClearable
              error={listError || undefined}
            />
          </div>
          <div className="orgd-field orgd-list-row__specialization">
            <label>Specialization</label>
            <CustomDropdown
              name="orgd-specializations"
              className="mb-0"
              isMulti
              {...specializationField.dropdownProps}
              error={specializationField.error || undefined}
              helpText={specializationField.note}
              placeholder="Select or type to add"
              styles={specializationDropdownStyles}
              isDisabled={readOnly}
            />
          </div>
        </div>
      </div>

      {/* Form actions - outside the card */}
      {!readOnly && (
        <div className="orgd-actions-row">
          <CustomButton className="orgd-btn-save" onClick={handleSubmit}>
            {editingOrg !== null ? 'Update Record' : 'Save Record'}
          </CustomButton>
          <CustomButton variant="light" className="orgd-btn-cancel" onClick={onCancel}>
            Cancel
          </CustomButton>
        </div>
      )}
    </div>
  );
};

export default OrganizationDirectory;
